/**
 * WC Barbearia - Aplicação Frontend Vanilla SPA
 * HTML5, CSS3 e JavaScript Puros
 */

const API_BASE = '/api';

// Estado Global da Aplicação
const state = {
  user: null,
  token: localStorage.getItem('wc_token'),
  servicos: [],
  agendamentos: [],
  vouchers: [],
  currentStep: 1,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  currentCalendarMonth: new Date(),
  adminFilter: 'Todos',
};

// ---------------------------------------------------------------------------
// Utilitários de Formatação & Notificação
// ---------------------------------------------------------------------------
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateObj) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(dateObj);
}

function formatISODate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------------
// Cliente HTTP Fetch com Interceptor Bearer Token
// ---------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        logout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      const msg = data.detail || (data.errors ? JSON.stringify(data.errors) : 'Erro na requisição');
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Autenticação & Sessão
// ---------------------------------------------------------------------------
async function checkAuth() {
  if (!state.token) {
    navigateTo('login');
    return;
  }

  try {
    const user = await apiFetch('/auth/me');
    state.user = user;
    if (user.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo('home');
    }
  } catch (e) {
    logout();
  }
}

function logout() {
  localStorage.removeItem('wc_token');
  state.token = null;
  state.user = null;
  navigateTo('login');
}

// ---------------------------------------------------------------------------
// Roteador SPA
// ---------------------------------------------------------------------------
function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-target="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = (viewName === 'login' || viewName === 'admin') ? 'none' : 'flex';
  }

  // Ações ao entrar em cada tela
  if (viewName === 'home') loadHome();
  if (viewName === 'agendar') initBooking();
  if (viewName === 'fidelidade') loadLoyalty();
  if (viewName === 'admin') loadAdmin();
}

// ---------------------------------------------------------------------------
// Tela: Login & Cadastro
// ---------------------------------------------------------------------------
function setupAuthEvents() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const registerFields = document.getElementById('register-fields');
  const authForm = document.getElementById('auth-form');
  const authSubmit = document.getElementById('auth-submit');

  let mode = 'login';

  tabLogin?.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    registerFields.style.display = 'none';
    authSubmit.textContent = 'Entrar';
  });

  tabRegister?.addEventListener('click', () => {
    mode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerFields.style.display = 'block';
    authSubmit.textContent = 'Criar minha conta';
  });

  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const telefone = document.getElementById('auth-tel').value.trim();
    const senha = document.getElementById('auth-pass').value;

    authSubmit.disabled = true;
    authSubmit.textContent = 'Processando...';

    try {
      let res;
      if (mode === 'login') {
        res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ telefone, senha }),
        });
      } else {
        const nome = document.getElementById('auth-nome').value.trim();
        const is_membro = document.getElementById('auth-membro').checked;
        res = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ nome, telefone, senha, is_membro }),
        });
      }

      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('wc_token', res.token);

      showToast(`Bem-vindo, ${res.user.nome.split(' ')[0]}!`, 'success');
      if (res.user.role === 'admin') {
        navigateTo('admin');
      } else {
        navigateTo('home');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = mode === 'login' ? 'Entrar' : 'Criar minha conta';
    }
  });
}

// ---------------------------------------------------------------------------
// Tela: Home (Dashboard do Cliente)
// ---------------------------------------------------------------------------
async function loadHome() {
  if (!state.user) return;

  // Atualiza dados do usuário
  try {
    const user = await apiFetch('/auth/me');
    state.user = user;
  } catch (e) {}

  document.getElementById('home-user-name').textContent = state.user.nome.split(' ')[0];
  const crownIcon = document.getElementById('home-crown-icon');
  if (crownIcon) crownIcon.style.display = state.user.is_membro ? 'inline-block' : 'none';

  // Pontos de Fidelidade
  const pontos = state.user.pontos_fidelidade || 0;
  document.getElementById('home-pontos-val').textContent = pontos;
  const progressPercent = Math.min(100, pontos);
  document.getElementById('home-progress-fill').style.width = `${progressPercent}%`;

  const infoEl = document.getElementById('home-pontos-info');
  if (pontos >= 100) {
    infoEl.textContent = '🎉 Você pode resgatar um voucher de R$ 20 agora!';
    infoEl.style.color = '#34d399';
  } else {
    infoEl.textContent = `Faltam ${100 - pontos} pontos para resgatar R$ 20 de desconto`;
    infoEl.style.color = 'var(--text-muted)';
  }

  // Agendamentos
  try {
    const agendamentos = await apiFetch('/agendamentos/');
    state.agendamentos = agendamentos;

    // Próximo agendamento
    const now = new Date();
    const futuros = agendamentos
      .filter((a) => a.status !== 'Cancelado' && new Date(a.data_hora_inicio) > now)
      .sort((a, b) => new Date(a.data_hora_inicio) - new Date(b.data_hora_inicio));

    const nextContainer = document.getElementById('home-next-appt');
    if (futuros.length > 0) {
      const next = futuros[0];
      nextContainer.innerHTML = `
        <div class="bento-card" style="border-color: var(--gold-border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.15rem;">${next.servico_nome}</h3>
            <span class="badge badge-${next.status.toLowerCase()}">${next.status}</span>
          </div>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">
            📅 ${formatDateTime(next.data_hora_inicio)}
          </p>
          <p style="color: var(--gold-primary); font-weight: 700; margin-top: 0.25rem;">
            ${formatBRL(next.valor_final)}
          </p>
        </div>
      `;
    } else {
      nextContainer.innerHTML = `
        <button onclick="navigateTo('agendar')" class="btn btn-secondary" style="border-style: dashed; justify-content: space-between;">
          <span>Nenhum horário marcado. Que tal agendar?</span>
          <span>➜</span>
        </button>
      `;
    }

    // Histórico
    const historyList = document.getElementById('home-history-list');
    if (agendamentos.length > 0) {
      historyList.innerHTML = agendamentos
        .map(
          (a) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
          <div>
            <p style="font-weight: 600; font-size: 0.9rem;">${a.servico_nome}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(a.data_hora_inicio)}</p>
          </div>
          <span class="badge badge-${a.status.toLowerCase()}">${a.status}</span>
        </div>
      `
        )
        .join('');
    } else {
      historyList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhum agendamento realizado.</p>';
    }
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Tela: Agendamento em 3 Passos
// ---------------------------------------------------------------------------
function initBooking() {
  state.currentStep = 1;
  state.selectedService = null;
  state.selectedDate = null;
  state.selectedSlot = null;
  renderBookingStep();
  loadServices();
}

function updateStepper(step) {
  state.currentStep = step;
  document.getElementById('step-indicator').textContent = `Passo ${step} de 3`;
  document.getElementById('step-bar-1').className = `step-bar ${step >= 1 ? 'active' : ''}`;
  document.getElementById('step-bar-2').className = `step-bar ${step >= 2 ? 'active' : ''}`;
  document.getElementById('step-bar-3').className = `step-bar ${step >= 3 ? 'active' : ''}`;

  document.getElementById('booking-step-1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('booking-step-2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('booking-step-3').style.display = step === 3 ? 'block' : 'none';
  document.getElementById('booking-success').style.display = 'none';
}

function renderBookingStep() {
  updateStepper(state.currentStep);
}

async function loadServices() {
  try {
    const list = await apiFetch('/servicos/');
    state.servicos = list;
    const container = document.getElementById('services-container');

    container.innerHTML = list
      .map(
        (s) => `
      <div class="service-card" onclick="selectService(${s.id})">
        <img src="${s.imagem_url || 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=150'}" class="service-thumb" alt="${s.nome}">
        <div style="flex: 1; min-width: 0;">
          <h4 style="font-size: 1.05rem; font-weight: 600;">${s.nome}</h4>
          <p style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.descricao || ''}</p>
          <div style="display: flex; gap: 0.75rem; font-size: 0.8rem; margin-top: 0.35rem;">
            <span style="color: var(--text-muted);">⏱ ${s.duracao_minutos} min</span>
            <span style="color: var(--gold-primary); font-weight: 700;">${formatBRL(s.preco_base)}</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    showToast('Falha ao carregar catálogo de serviços', 'error');
  }
}

window.selectService = function (id) {
  state.selectedService = state.servicos.find((s) => s.id == id);
  updateStepper(2);
  renderCalendar();
};

// Calendário Interativo em Vanilla JS
function renderCalendar() {
  const wrapper = document.getElementById('calendar-days');
  const monthTitle = document.getElementById('calendar-month-title');

  const curr = state.currentCalendarMonth;
  const year = curr.getFullYear();
  const month = curr.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  monthTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  wrapper.innerHTML = '';

  // Espaços vazios antes do 1º dia
  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    wrapper.appendChild(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const btn = document.createElement('button');
    btn.className = 'calendar-day';
    btn.textContent = day;

    const dateCandidate = new Date(year, month, day);
    const dayOfWeek = dateCandidate.getDay(); // 0 = Domingo, 5 = Sex, 6 = Sab

    // Desativa domingos e dias no passado
    if (dateCandidate < today || dayOfWeek === 0) {
      btn.disabled = true;
    } else {
      // Destaque para sextas e sábados
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        btn.classList.add('peak-day');
      }

      if (state.selectedDate && dateCandidate.toDateString() === state.selectedDate.toDateString()) {
        btn.classList.add('selected');
      }

      btn.onclick = () => {
        document.querySelectorAll('.calendar-day').forEach((d) => d.classList.remove('selected'));
        btn.classList.add('selected');
        state.selectedDate = dateCandidate;
        loadSlotsForDate(dateCandidate);
      };
    }

    wrapper.appendChild(btn);
  }
}

window.changeCalendarMonth = function (delta) {
  const m = state.currentCalendarMonth;
  m.setMonth(m.getMonth() + delta);
  renderCalendar();
};

async function loadSlotsForDate(dateObj) {
  const container = document.getElementById('slots-container');
  const lockAlert = document.getElementById('peak-lock-alert');
  const dayOfWeek = dateObj.getDay();

  // Alerta de Sexta/Sábado para Não-Membros
  if ((dayOfWeek === 5 || dayOfWeek === 6) && !state.user?.is_membro) {
    lockAlert.style.display = 'block';
  } else {
    lockAlert.style.display = 'none';
  }

  container.innerHTML = '<p style="grid-column: span 4; text-align: center; color: var(--gold-primary);">Consultando horários...</p>';

  try {
    const res = await apiFetch(`/agendamentos/disponibilidade?data=${formatISODate(dateObj)}&servico_id=${state.selectedService.id}`);
    const slots = res.slots || [];

    if (slots.length === 0) {
      container.innerHTML = '<p style="grid-column: span 4; text-align: center; color: var(--text-muted);">Nenhum horário disponível neste dia.</p>';
      return;
    }

    container.innerHTML = slots
      .map((sl) => {
        const isSelected = state.selectedSlot?.hora === sl.hora;
        return `
        <button
          type="button"
          class="slot-btn ${isSelected ? 'selected' : ''}"
          ${!sl.disponivel ? 'disabled' : ''}
          onclick="selectSlot('${sl.hora}', '${sl.inicio_iso}', '${sl.fim_iso}')"
        >
          ${sl.hora}
        </button>
      `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="grid-column: span 4; text-align: center; color: #f87171;">${err.message}</p>`;
  }
}

window.selectSlot = function (hora, inicio_iso, fim_iso) {
  state.selectedSlot = { hora, inicio_iso, fim_iso };
  document.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
  event.target.classList.add('selected');

  document.getElementById('btn-to-step-3').disabled = false;
};

window.goToStep3 = function () {
  if (!state.selectedSlot) return;

  // Monta resumo da confirmação
  document.getElementById('summary-service-name').textContent = state.selectedService.nome;
  document.getElementById('summary-date').textContent = formatDate(state.selectedDate);
  document.getElementById('summary-time').textContent = `${state.selectedSlot.hora} (${state.selectedService.duracao_minutos} min)`;
  document.getElementById('summary-client').textContent = state.user.nome + (state.user.is_membro ? ' (VIP 👑)' : '');
  document.getElementById('summary-total').textContent = formatBRL(state.selectedService.preco_base);

  updateStepper(3);
};

window.confirmBooking = async function () {
  const btn = document.getElementById('btn-confirm-booking');
  btn.disabled = true;
  btn.textContent = 'Reservando horário...';

  try {
    await apiFetch('/agendamentos/', {
      method: 'POST',
      body: JSON.stringify({
        servico_id: state.selectedService.id,
        data_hora_inicio: state.selectedSlot.inicio_iso,
      }),
    });

    // Sucesso
    document.getElementById('booking-step-3').style.display = 'none';
    const successView = document.getElementById('booking-success');
    successView.style.display = 'block';

    document.getElementById('success-summary').textContent =
      `${state.selectedService.nome} • ${formatDate(state.selectedDate)} às ${state.selectedSlot.hora}`;

    showToast('Agendamento confirmado com sucesso!', 'success');
  } catch (err) {
    if (err.status === 409) {
      showToast('Este horário acabou de ser ocupado. Por favor, selecione outro.', 'error');
      updateStepper(2);
      loadSlotsForDate(state.selectedDate);
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Agendamento';
  }
};

window.bookingBack = function () {
  if (state.currentStep > 1) {
    updateStepper(state.currentStep - 1);
  } else {
    navigateTo('home');
  }
};

// ---------------------------------------------------------------------------
// Tela: Clube de Fidelidade
// ---------------------------------------------------------------------------
async function loadLoyalty() {
  if (!state.user) return;

  try {
    const user = await apiFetch('/auth/me');
    state.user = user;
  } catch (e) {}

  document.getElementById('loyalty-membership-status').textContent = state.user.is_membro ? 'Membro VIP' : 'Cliente';
  document.getElementById('loyalty-crown-icon').style.display = state.user.is_membro ? 'inline' : 'none';

  const pontos = state.user.pontos_fidelidade || 0;
  document.getElementById('loyalty-points-val').textContent = pontos;
  document.getElementById('loyalty-progress-fill').style.width = `${Math.min(100, pontos)}%`;

  const btnRedeem = document.getElementById('btn-redeem-voucher');
  if (pontos >= 100) {
    btnRedeem.disabled = false;
    btnRedeem.textContent = '✨ Resgatar voucher de R$ 20 agora';
    document.getElementById('loyalty-points-hint').textContent = 'Pronto para resgatar desconto!';
  } else {
    btnRedeem.disabled = true;
    btnRedeem.textContent = 'Pontos insuficientes (Mínimo: 100)';
    document.getElementById('loyalty-points-hint').textContent = `Faltam ${100 - pontos} pontos para o próximo voucher`;
  }

  // Lista de vouchers
  try {
    const vouchers = await apiFetch('/vouchers/');
    state.vouchers = vouchers;
    const container = document.getElementById('vouchers-list');

    if (vouchers.length > 0) {
      container.innerHTML = vouchers
        .map(
          (v) => `
        <div class="voucher-card">
          <div>
            <p class="voucher-code">${v.codigo}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Criado em: ${new Date(v.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 1.15rem; font-weight: 700; color: var(--gold-primary);">
              ${formatBRL(v.valor_desconto)}
            </p>
            <span style="font-size: 0.72rem; color: ${v.is_resgatado ? '#34d399' : '#fbbf24'};">
              ${v.is_resgatado ? '✔ Utilizado' : '● Disponível'}
            </span>
          </div>
        </div>
      `
        )
        .join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhum voucher resgatado ainda.</p>';
    }
  } catch (err) {
    console.error(err);
  }
}

window.redeemLoyaltyVoucher = async function () {
  const btn = document.getElementById('btn-redeem-voucher');
  btn.disabled = true;
  btn.textContent = 'Resgatando...';

  try {
    const res = await apiFetch('/fidelidade/resgatar/', { method: 'POST' });
    showToast(`Voucher ${res.codigo} gerado com sucesso! -100 pontos debitados.`, 'success');
    loadLoyalty();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
};

// ---------------------------------------------------------------------------
// Tela: Painel do Administrador (Barbeiro)
// ---------------------------------------------------------------------------
async function loadAdmin() {
  if (!state.user || state.user.role !== 'admin') {
    navigateTo('login');
    return;
  }

  document.getElementById('admin-user-name').textContent = state.user.nome;

  try {
    const appts = await apiFetch('/agendamentos/');
    state.agendamentos = appts;

    // Métricas do Dia
    const todayStr = formatISODate(new Date());
    const hojeAppts = appts.filter((a) => a.data_hora_inicio.startsWith(todayStr) && a.status !== 'Cancelado');
    const pendentes = appts.filter((a) => a.status === 'Pendente');
    const concluidos = appts.filter((a) => a.status === 'Concluido');
    const receita = concluidos.reduce((acc, a) => acc + (a.valor_final || 0), 0);

    document.getElementById('stat-hoje').textContent = hojeAppts.length;
    document.getElementById('stat-pendentes').textContent = pendentes.length;
    document.getElementById('stat-concluidos').textContent = concluidos.length;
    document.getElementById('stat-receita').textContent = formatBRL(receita);

    renderAdminTable();
  } catch (err) {
    showToast('Falha ao carregar painel administrativo', 'error');
  }
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  const filter = state.adminFilter;

  const filtered = filter === 'Todos' ? state.agendamentos : state.agendamentos.filter((a) => a.status === filter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum agendamento encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (a) => `
    <tr>
      <td>
        <strong>${a.usuario_nome}</strong> ${a.usuario_membro ? '👑' : ''}
        <br><span style="font-size: 0.75rem; color: var(--text-muted);">${a.usuario_telefone}</span>
      </td>
      <td>${a.servico_nome}</td>
      <td>${formatDateTime(a.data_hora_inicio)}</td>
      <td style="color: var(--gold-primary); font-weight: 600;">${formatBRL(a.valor_final)}</td>
      <td>
        <span class="badge badge-${a.status.toLowerCase()}">${a.status}</span>
      </td>
      <td style="text-align: right;">
        <select class="admin-select" onchange="changeAppointmentStatus(${a.id}, this.value)">
          <option value="Pendente" ${a.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
          <option value="Confirmado" ${a.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
          <option value="Concluido" ${a.status === 'Concluido' ? 'selected' : ''}>Concluido</option>
          <option value="Cancelado" ${a.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </td>
    </tr>
  `
    )
    .join('');
}

window.filterAdminAppointments = function (statusName, btnEl) {
  state.adminFilter = statusName;
  document.querySelectorAll('.admin-filter-pill').forEach((p) => p.classList.remove('active'));
  btnEl.classList.add('active');
  renderAdminTable();
};

window.changeAppointmentStatus = async function (id, novoStatus) {
  try {
    await apiFetch(`/agendamentos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: novoStatus }),
    });

    showToast(`Status atualizado para "${novoStatus}"!`, 'success');
    if (novoStatus === 'Concluido') {
      showToast('🎁 +10 pontos de fidelidade creditados automaticamente!', 'info');
    }
    loadAdmin();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupAuthEvents();

  // Bottom Nav Cliques
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target === 'logout') {
        logout();
      } else {
        navigateTo(target);
      }
    });
  });

  checkAuth();
});
