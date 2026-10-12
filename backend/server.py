from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import random
import string
import bcrypt
import jwt

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
POINTS_PER_SERVICE = int(os.environ.get("POINTS_PER_SERVICE", "10"))
POINTS_FOR_VOUCHER = int(os.environ.get("POINTS_FOR_VOUCHER", "100"))
VOUCHER_VALUE = float(os.environ.get("VOUCHER_VALUE", "20"))
OPEN_HOUR = int(os.environ.get("OPEN_HOUR", "9"))
CLOSE_HOUR = int(os.environ.get("CLOSE_HOUR", "20"))
SLOT_INTERVAL = int(os.environ.get("SLOT_INTERVAL_MINUTES", "30"))
# Peak days (members only): Friday=4, Saturday=5 (Python weekday, Mon=0)
PEAK_DAYS = {4, 5}
ACTIVE_STATUSES = ["Pendente", "Confirmado"]
STATUS_VALUES = ["Pendente", "Confirmado", "Concluido", "Cancelado"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("wc_barbearia")

# ----------------------------------------------------------------------------
# Mongo helpers
# ----------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def gen_voucher_code() -> str:
    return "WC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def user_public(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "nome": doc["nome"],
        "telefone": doc["telefone"],
        "email": doc.get("email"),
        "role": doc["role"],
        "is_membro": doc.get("is_membro", False),
        "pontos_fidelidade": doc.get("pontos_fidelidade", 0),
    }


# ----------------------------------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------------------------------
class RegisterInput(BaseModel):
    nome: str
    telefone: str
    senha: str
    is_membro: bool = False


class LoginInput(BaseModel):
    telefone: str
    senha: str


class ServicoInput(BaseModel):
    nome: str
    descricao: str = ""
    duracao_minutos: int = 30
    preco_base: float = 0.0
    imagem_url: Optional[str] = None


class AgendamentoInput(BaseModel):
    servico_id: str
    data_hora_inicio: str  # ISO local, e.g. "2026-06-12T09:00:00"


class StatusInput(BaseModel):
    status: str


# ----------------------------------------------------------------------------
# App
# ----------------------------------------------------------------------------
app = FastAPI(title="WC Barbearia API")
api = APIRouter(prefix="/api")


# ----------------------------------------------------------------------------
# Auth dependency
# ----------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(data: RegisterInput):
    telefone = data.telefone.strip()
    existing = await db.users.find_one({"telefone": telefone})
    if existing:
        raise HTTPException(status_code=400, detail="Telefone já cadastrado")
    doc = {
        "nome": data.nome.strip(),
        "telefone": telefone,
        "email": None,
        "password_hash": hash_password(data.senha),
        "role": "cliente",
        "is_membro": data.is_membro,
        "pontos_fidelidade": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_access_token(str(res.inserted_id), "cliente")
    return {"token": token, "user": user_public(doc)}


@api.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"telefone": data.telefone.strip()})
    if not user or not verify_password(data.senha, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Telefone ou senha inválidos")
    token = create_access_token(str(user["_id"]), user["role"])
    return {"token": token, "user": user_public(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


# ----------------------------------------------------------------------------
# Serviços
# ----------------------------------------------------------------------------
@api.get("/servicos/")
async def list_servicos():
    servicos = await db.servicos.find().sort("preco_base", 1).to_list(200)
    return [
        {
            "id": str(s["_id"]),
            "nome": s["nome"],
            "descricao": s.get("descricao", ""),
            "duracao_minutos": s["duracao_minutos"],
            "preco_base": s["preco_base"],
            "imagem_url": s.get("imagem_url"),
        }
        for s in servicos
    ]


@api.post("/servicos/")
async def create_servico(data: ServicoInput, admin: dict = Depends(require_admin)):
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.servicos.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


# ----------------------------------------------------------------------------
# Disponibilidade (time-slot engine)
# ----------------------------------------------------------------------------
def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and a_end > b_start


@api.get("/agendamentos/disponibilidade")
async def disponibilidade(
    data: str = Query(..., description="YYYY-MM-DD"),
    servico_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    try:
        day = datetime.strptime(data, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use YYYY-MM-DD")

    servico = await db.servicos.find_one({"_id": ObjectId(servico_id)})
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    duracao = servico["duracao_minutos"]

    weekday = day.weekday()  # Mon=0 ... Sun=6
    is_peak = weekday in PEAK_DAYS
    is_sunday = weekday == 6
    is_membro = user.get("is_membro", False)

    # Existing active appointments for this day
    existing = await db.agendamentos.find(
        {"data_hora_inicio": {"$regex": f"^{data}"}, "status": {"$in": ACTIVE_STATUSES}}
    ).to_list(500)
    busy = [(parse_iso(e["data_hora_inicio"]), parse_iso(e["data_hora_fim"])) for e in existing]

    slots = []
    if not is_sunday:
        cur = datetime.combine(day, datetime.min.time()).replace(hour=OPEN_HOUR)
        close_dt = datetime.combine(day, datetime.min.time()).replace(hour=CLOSE_HOUR)
        while cur + timedelta(minutes=duracao) <= close_dt:
            slot_end = cur + timedelta(minutes=duracao)
            conflict = any(overlaps(cur, slot_end, bs, be) for bs, be in busy)
            # Peak-day gating: non-members cannot book Fri/Sat
            bloqueado_membro = is_peak and not is_membro
            slots.append(
                {
                    "hora": cur.strftime("%H:%M"),
                    "inicio_iso": cur.isoformat(),
                    "fim_iso": slot_end.isoformat(),
                    "disponivel": (not conflict) and (not bloqueado_membro),
                    "ocupado": conflict,
                    "bloqueado_membro": bloqueado_membro,
                }
            )
            cur += timedelta(minutes=SLOT_INTERVAL)

    return {
        "data": data,
        "weekday": weekday,
        "is_peak": is_peak,
        "is_sunday": is_sunday,
        "servico": {"id": str(servico["_id"]), "nome": servico["nome"], "duracao_minutos": duracao},
        "slots": slots,
    }


# ----------------------------------------------------------------------------
# Agendamentos
# ----------------------------------------------------------------------------
async def enrich_agendamento(a: dict) -> dict:
    servico = await db.servicos.find_one({"_id": ObjectId(a["servico_id"])})
    usuario = await db.users.find_one({"_id": ObjectId(a["usuario_id"])})
    return {
        "id": str(a["_id"]),
        "usuario_id": a["usuario_id"],
        "usuario_nome": usuario["nome"] if usuario else "—",
        "usuario_telefone": usuario["telefone"] if usuario else "—",
        "usuario_membro": usuario.get("is_membro", False) if usuario else False,
        "servico_id": a["servico_id"],
        "servico_nome": servico["nome"] if servico else "—",
        "data_hora_inicio": a["data_hora_inicio"],
        "data_hora_fim": a["data_hora_fim"],
        "status": a["status"],
        "valor_final": a["valor_final"],
    }


@api.post("/agendamentos/")
async def create_agendamento(data: AgendamentoInput, user: dict = Depends(get_current_user)):
    servico = await db.servicos.find_one({"_id": ObjectId(data.servico_id)})
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")

    try:
        inicio = parse_iso(data.data_hora_inicio)
    except ValueError:
        raise HTTPException(status_code=400, detail="data_hora_inicio inválida")
    fim = inicio + timedelta(minutes=servico["duracao_minutos"])

    # Membership peak-day rule
    if inicio.weekday() in PEAK_DAYS and not user.get("is_membro", False):
        raise HTTPException(
            status_code=403,
            detail="Horários de sexta e sábado são exclusivos para membros do clube.",
        )

    # Double-booking validation -> HTTP 409
    day_str = inicio.strftime("%Y-%m-%d")
    existing = await db.agendamentos.find(
        {"data_hora_inicio": {"$regex": f"^{day_str}"}, "status": {"$in": ACTIVE_STATUSES}}
    ).to_list(500)
    for e in existing:
        if overlaps(inicio, fim, parse_iso(e["data_hora_inicio"]), parse_iso(e["data_hora_fim"])):
            raise HTTPException(status_code=409, detail="Este horário já está ocupado. Escolha outro.")

    doc = {
        "usuario_id": str(user["_id"]),
        "servico_id": data.servico_id,
        "data_hora_inicio": inicio.isoformat(),
        "data_hora_fim": fim.isoformat(),
        "status": "Pendente",
        "valor_final": servico["preco_base"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.agendamentos.insert_one(doc)
    doc["_id"] = res.inserted_id
    return await enrich_agendamento(doc)


@api.get("/agendamentos/")
async def list_agendamentos(user: dict = Depends(get_current_user)):
    query = {} if user.get("role") == "admin" else {"usuario_id": str(user["_id"])}
    items = await db.agendamentos.find(query).sort("data_hora_inicio", -1).to_list(1000)
    return [await enrich_agendamento(a) for a in items]


# Loyalty engine: fires when status transitions to "Concluido" (mimics Django signal)
async def credit_loyalty_points(agendamento: dict):
    await db.users.update_one(
        {"_id": ObjectId(agendamento["usuario_id"])},
        {"$inc": {"pontos_fidelidade": POINTS_PER_SERVICE}},
    )
    logger.info(
        "Fidelidade: +%s pontos creditados ao usuário %s (agendamento %s concluído)",
        POINTS_PER_SERVICE,
        agendamento["usuario_id"],
        agendamento["_id"],
    )


@api.patch("/agendamentos/{agendamento_id}/status")
async def update_status(agendamento_id: str, data: StatusInput, admin: dict = Depends(require_admin)):
    if data.status not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {STATUS_VALUES}")
    agendamento = await db.agendamentos.find_one({"_id": ObjectId(agendamento_id)})
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    was_concluido = agendamento["status"] == "Concluido"
    await db.agendamentos.update_one(
        {"_id": ObjectId(agendamento_id)}, {"$set": {"status": data.status}}
    )
    agendamento["status"] = data.status

    # Signal-like trigger: credit points only on fresh transition to Concluido
    if data.status == "Concluido" and not was_concluido:
        await credit_loyalty_points(agendamento)

    return await enrich_agendamento(agendamento)


# ----------------------------------------------------------------------------
# Fidelidade / Vouchers
# ----------------------------------------------------------------------------
@api.get("/vouchers/")
async def list_vouchers(user: dict = Depends(get_current_user)):
    items = await db.vouchers.find({"usuario_id": str(user["_id"])}).sort("created_at", -1).to_list(500)
    return [
        {
            "id": str(v["_id"]),
            "codigo": v["codigo"],
            "valor_desconto": v["valor_desconto"],
            "is_resgatado": v["is_resgatado"],
            "created_at": v["created_at"],
        }
        for v in items
    ]


@api.post("/fidelidade/resgatar/")
async def resgatar_fidelidade(user: dict = Depends(get_current_user)):
    fresh = await db.users.find_one({"_id": user["_id"]})
    pontos = fresh.get("pontos_fidelidade", 0)
    if pontos < POINTS_FOR_VOUCHER:
        raise HTTPException(
            status_code=400,
            detail=f"Pontos insuficientes. Você tem {pontos}, precisa de {POINTS_FOR_VOUCHER}.",
        )
    # Debit points and generate voucher atomically-ish
    await db.users.update_one(
        {"_id": user["_id"]}, {"$inc": {"pontos_fidelidade": -POINTS_FOR_VOUCHER}}
    )
    voucher = {
        "usuario_id": str(user["_id"]),
        "codigo": gen_voucher_code(),
        "valor_desconto": VOUCHER_VALUE,
        "is_resgatado": False,
        "pontos_usados": POINTS_FOR_VOUCHER,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.vouchers.insert_one(voucher)
    return {
        "id": str(res.inserted_id),
        "codigo": voucher["codigo"],
        "valor_desconto": voucher["valor_desconto"],
        "is_resgatado": False,
        "pontos_restantes": pontos - POINTS_FOR_VOUCHER,
    }


@api.get("/")
async def root():
    return {"message": "WC Barbearia API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------------
# Startup: indexes + seed
# ----------------------------------------------------------------------------
SEED_SERVICOS = [
    {
        "nome": "Corte Clássico",
        "descricao": "Corte na tesoura e máquina com acabamento na navalha.",
        "duracao_minutos": 30,
        "preco_base": 45.0,
        "imagem_url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Barba Terapia",
        "descricao": "Modelagem de barba com toalha quente e óleos essenciais.",
        "duracao_minutos": 30,
        "preco_base": 40.0,
        "imagem_url": "https://images.unsplash.com/photo-1524230616393-d6229fcd2eff?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Corte + Barba",
        "descricao": "Combo completo: corte premium e barba terapia.",
        "duracao_minutos": 60,
        "preco_base": 75.0,
        "imagem_url": "https://images.unsplash.com/photo-1621645582931-d1d3e6564943?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Pezinho / Acabamento",
        "descricao": "Retoque rápido de contorno e pezinho.",
        "duracao_minutos": 30,
        "preco_base": 25.0,
        "imagem_url": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("telefone", unique=True)
    await db.agendamentos.create_index("data_hora_inicio")
    await db.agendamentos.create_index([("usuario_id", 1), ("status", 1)])
    await db.vouchers.create_index("usuario_id")

    # Seed admin
    admin_tel = os.environ["ADMIN_TELEFONE"]
    admin_pass = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"telefone": admin_tel})
    if not existing:
        await db.users.insert_one(
            {
                "nome": os.environ.get("ADMIN_NOME", "Admin"),
                "telefone": admin_tel,
                "email": os.environ.get("ADMIN_EMAIL"),
                "password_hash": hash_password(admin_pass),
                "role": "admin",
                "is_membro": True,
                "pontos_fidelidade": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info("Admin seeded: %s", admin_tel)
    elif not verify_password(admin_pass, existing["password_hash"]):
        await db.users.update_one(
            {"telefone": admin_tel}, {"$set": {"password_hash": hash_password(admin_pass), "role": "admin"}}
        )

    # Seed serviços
    if await db.servicos.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SEED_SERVICOS:
            await db.servicos.insert_one({**s, "created_at": now})
        logger.info("Serviços seeded: %s", len(SEED_SERVICOS))


@app.on_event("shutdown")
async def shutdown():
    client.close()
