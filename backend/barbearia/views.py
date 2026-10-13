import logging
from datetime import datetime, date, time, timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Servico, Agendamento, Voucher
from .serializers import ServicoSerializer, AgendamentoInputSerializer, StatusUpdateSerializer, VoucherSerializer

logger = logging.getLogger("wc_barbearia")

def is_admin(user):
    return user.is_authenticated and (user.role == 'admin' or user.is_staff or user.is_superuser)

def overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and a_end > b_start

class RootView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"message": "WC Barbearia API", "status": "ok"})

class ServicoListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        servicos = Servico.objects.all().order_by('preco_base')
        return Response([s.to_dict() for s in servicos])

    def post(self, request):
        if not is_admin(request.user):
            return Response({"detail": "Acesso restrito ao administrador"}, status=status.HTTP_403_FORBIDDEN)
        serializer = ServicoSerializer(data=request.data)
        if serializer.is_valid():
            servico = serializer.save()
            return Response(servico.to_dict(), status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DisponibilidadeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data_str = request.query_params.get('data')
        servico_id = request.query_params.get('servico_id')

        if not data_str or not servico_id:
            return Response({"detail": "Os parâmetros 'data' e 'servico_id' são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            day = datetime.strptime(data_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Data inválida. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            servico = Servico.objects.get(pk=servico_id)
        except (Servico.DoesNotExist, ValueError):
            return Response({"detail": "Serviço não encontrado"}, status=status.HTTP_404_NOT_FOUND)

        duracao = servico.duracao_minutos
        weekday = day.weekday()  # Seg=0 ... Dom=6
        peak_days = getattr(settings, 'PEAK_DAYS', {4, 5})
        is_peak = weekday in peak_days
        is_sunday = (weekday == 6)
        is_membro = bool(request.user.is_membro)

        # Buscar agendamentos existentes no mesmo dia
        start_of_day = timezone.make_aware(datetime.combine(day, time.min))
        end_of_day = timezone.make_aware(datetime.combine(day, time.max))

        existing = Agendamento.objects.filter(
            data_hora_inicio__gte=start_of_day,
            data_hora_inicio__lte=end_of_day,
            status__in=["Pendente", "Confirmado"]
        )
        busy = [(e.data_hora_inicio, e.data_hora_fim) for e in existing]

        open_hour = getattr(settings, 'OPEN_HOUR', 9)
        close_hour = getattr(settings, 'CLOSE_HOUR', 20)
        slot_interval = getattr(settings, 'SLOT_INTERVAL_MINUTES', 30)

        slots = []
        if not is_sunday:
            cur_naive = datetime.combine(day, time(hour=open_hour, minute=0))
            close_naive = datetime.combine(day, time(hour=close_hour, minute=0))

            while cur_naive + timedelta(minutes=duracao) <= close_naive:
                end_naive = cur_naive + timedelta(minutes=duracao)
                cur_dt = timezone.make_aware(cur_naive)
                end_dt = timezone.make_aware(end_naive)

                conflict = any(overlaps(cur_dt, end_dt, b_start, b_end) for b_start, b_end in busy)
                bloqueado_membro = is_peak and not is_membro

                slots.append({
                    "hora": cur_naive.strftime("%H:%M"),
                    "inicio_iso": cur_naive.isoformat(),
                    "fim_iso": end_naive.isoformat(),
                    "disponivel": (not conflict) and (not bloqueado_membro),
                    "ocupado": conflict,
                    "bloqueado_membro": bloqueado_membro,
                })
                cur_naive += timedelta(minutes=slot_interval)

        return Response({
            "data": data_str,
            "weekday": weekday,
            "is_peak": is_peak,
            "is_sunday": is_sunday,
            "servico": {
                "id": str(servico.id),
                "nome": servico.nome,
                "duracao_minutos": duracao,
            },
            "slots": slots,
        })

class AgendamentoListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if is_admin(request.user):
            agendamentos = Agendamento.objects.select_related('usuario', 'servico').all()
        else:
            agendamentos = Agendamento.objects.select_related('usuario', 'servico').filter(usuario=request.user)

        return Response([a.to_enriched_dict() for a in agendamentos])

    def post(self, request):
        serializer = AgendamentoInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        servico_id = serializer.validated_data['servico_id']
        data_hora_inicio_str = serializer.validated_data['data_hora_inicio']

        try:
            servico = Servico.objects.get(pk=servico_id)
        except Servico.DoesNotExist:
            return Response({"detail": "Serviço não encontrado"}, status=status.HTTP_404_NOT_FOUND)

        try:
            # Parse ISO e tornar timezone-aware se necessário
            inicio_naive = datetime.fromisoformat(data_hora_inicio_str.replace("Z", ""))
            if timezone.is_naive(inicio_naive):
                inicio = timezone.make_aware(inicio_naive)
            else:
                inicio = inicio_naive
        except ValueError:
            return Response({"detail": "data_hora_inicio inválida"}, status=status.HTTP_400_BAD_REQUEST)

        fim = inicio + timedelta(minutes=servico.duracao_minutos)
        peak_days = getattr(settings, 'PEAK_DAYS', {4, 5})

        # Regra do clube de membros para dias de pico
        if inicio.weekday() in peak_days and not request.user.is_membro:
            return Response(
                {"detail": "Horários de sexta e sábado são exclusivos para membros do clube."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Regra de conflito / Double-booking
        conflict = Agendamento.objects.filter(
            status__in=["Pendente", "Confirmado"],
            data_hora_inicio__lt=fim,
            data_hora_fim__gt=inicio,
        ).exists()

        if conflict:
            return Response(
                {"detail": "Este horário já está ocupado. Escolha outro."},
                status=status.HTTP_409_CONFLICT
            )

        agendamento = Agendamento.objects.create(
            usuario=request.user,
            servico=servico,
            data_hora_inicio=inicio,
            data_hora_fim=fim,
            status="Pendente",
            valor_final=servico.preco_base,
        )

        return Response(agendamento.to_enriched_dict(), status=status.HTTP_200_OK)

class AgendamentoStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not is_admin(request.user):
            return Response({"detail": "Acesso restrito ao administrador"}, status=status.HTTP_403_FORBIDDEN)

        try:
            agendamento = Agendamento.objects.select_related('usuario', 'servico').get(pk=pk)
        except Agendamento.DoesNotExist:
            return Response({"detail": "Agendamento não encontrado"}, status=status.HTTP_404_NOT_FOUND)

        serializer = StatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Status inválido. Use: ['Pendente', 'Confirmado', 'Concluido', 'Cancelado']"}, status=status.HTTP_400_BAD_REQUEST)

        novo_status = serializer.validated_data['status']
        agendamento.status = novo_status
        agendamento.save()  # Dispara signal de fidelidade se novo_status == 'Concluido'

        return Response(agendamento.to_enriched_dict(), status=status.HTTP_200_OK)

class VoucherListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vouchers = Voucher.objects.filter(usuario=request.user)
        return Response([v.to_dict() for v in vouchers])

class FidelidadeResgatarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.refresh_from_db()

        pts_necessarios = getattr(settings, 'POINTS_FOR_VOUCHER', 100)
        valor_voucher = getattr(settings, 'VOUCHER_VALUE', 20.00)

        if user.pontos_fidelidade < pts_necessarios:
            return Response(
                {"detail": f"Pontos insuficientes. Você tem {user.pontos_fidelidade}, precisa de {pts_necessarios}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Debita pontos
        user.pontos_fidelidade -= pts_necessarios
        user.save(update_fields=['pontos_fidelidade'])

        # Gera voucher
        voucher = Voucher.objects.create(
            usuario=user,
            valor_desconto=valor_voucher,
            pontos_usados=pts_necessarios,
            is_resgatado=False,
        )

        return Response({
            "id": str(voucher.id),
            "codigo": voucher.codigo,
            "valor_desconto": float(voucher.valor_desconto),
            "is_resgatado": False,
            "pontos_restantes": user.pontos_fidelidade,
        }, status=status.HTTP_200_OK)
