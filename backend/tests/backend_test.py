"""Backend tests for WC Barbearia API (FastAPI + MongoDB)."""
import os
import random
import string
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agenda-barber-25.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TEL = "11999990000"
ADMIN_PASS = "admin123"
MEMBER_TEL = "11988887777"
MEMBER_PASS = "cliente123"


def _rand_tel():
    return "11" + "".join(random.choices(string.digits, k=9))


def _next_weekday(target_wd: int) -> str:
    """target_wd: Mon=0 ... Sun=6"""
    today = date.today()
    delta = (target_wd - today.weekday()) % 7
    if delta == 0:
        delta = 7
    return (today + timedelta(days=delta)).strftime("%Y-%m-%d")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"telefone": ADMIN_TEL, "senha": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def member_token():
    # Try login; register if needed
    r = requests.post(f"{API}/auth/login", json={"telefone": MEMBER_TEL, "senha": MEMBER_PASS}, timeout=15)
    if r.status_code == 200:
        return r.json()["token"]
    r = requests.post(f"{API}/auth/register", json={
        "nome": "Cliente Membro", "telefone": MEMBER_TEL, "senha": MEMBER_PASS, "is_membro": True
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def nonmember_token():
    tel = _rand_tel()
    r = requests.post(f"{API}/auth/register", json={
        "nome": "TEST Non Member", "telefone": tel, "senha": "senha123", "is_membro": False
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def servicos(admin_token):
    r = requests.get(f"{API}/servicos/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0, "No seeded servicos"
    return data


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Health / Root ----------
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_admin_login(admin_token):
    r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"telefone": ADMIN_TEL, "senha": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_register_duplicate():
    r = requests.post(f"{API}/auth/register", json={
        "nome": "Dup", "telefone": ADMIN_TEL, "senha": "x", "is_membro": False
    }, timeout=15)
    assert r.status_code == 400


# ---------- Servicos ----------
def test_list_servicos(servicos):
    s = servicos[0]
    for k in ("id", "nome", "preco_base", "duracao_minutos"):
        assert k in s


# ---------- Disponibilidade ----------
def test_disponibilidade_weekday(member_token, servicos):
    # Pick next Monday (weekday 0) to avoid peak
    data = _next_weekday(0)
    r = requests.get(
        f"{API}/agendamentos/disponibilidade",
        params={"data": data, "servico_id": servicos[0]["id"]},
        headers=_h(member_token), timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["is_peak"] is False
    assert body["is_sunday"] is False
    assert len(body["slots"]) > 0


def test_disponibilidade_sunday_closed(member_token, servicos):
    data = _next_weekday(6)
    r = requests.get(
        f"{API}/agendamentos/disponibilidade",
        params={"data": data, "servico_id": servicos[0]["id"]},
        headers=_h(member_token), timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["is_sunday"] is True
    assert r.json()["slots"] == []


def test_disponibilidade_peak_nonmember(nonmember_token, servicos):
    data = _next_weekday(4)  # Friday
    r = requests.get(
        f"{API}/agendamentos/disponibilidade",
        params={"data": data, "servico_id": servicos[0]["id"]},
        headers=_h(nonmember_token), timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["is_peak"] is True
    assert all(s["bloqueado_membro"] is True for s in body["slots"])
    assert all(s["disponivel"] is False for s in body["slots"])


# ---------- Agendamentos: create / double-book / peak ----------
@pytest.fixture(scope="session")
def booked_slot(member_token, servicos):
    data = _next_weekday(1)  # Tuesday, non-peak
    inicio = f"{data}T14:00:00"
    r = requests.post(f"{API}/agendamentos/", json={
        "servico_id": servicos[0]["id"], "data_hora_inicio": inicio
    }, headers=_h(member_token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_agendamento(booked_slot):
    assert booked_slot["status"] == "Pendente"
    assert "id" in booked_slot


def test_double_booking_409(member_token, servicos, booked_slot):
    r = requests.post(f"{API}/agendamentos/", json={
        "servico_id": servicos[0]["id"],
        "data_hora_inicio": booked_slot["data_hora_inicio"],
    }, headers=_h(member_token), timeout=15)
    assert r.status_code == 409


def test_peak_nonmember_403(nonmember_token, servicos):
    data = _next_weekday(4)  # Friday
    r = requests.post(f"{API}/agendamentos/", json={
        "servico_id": servicos[0]["id"], "data_hora_inicio": f"{data}T10:00:00"
    }, headers=_h(nonmember_token), timeout=15)
    assert r.status_code == 403


def test_peak_member_allowed(member_token, servicos):
    data = _next_weekday(4)  # Friday
    r = requests.post(f"{API}/agendamentos/", json={
        "servico_id": servicos[0]["id"], "data_hora_inicio": f"{data}T11:30:00"
    }, headers=_h(member_token), timeout=15)
    # Should succeed (200) unless already booked (409 acceptable idempotency)
    assert r.status_code in (200, 409), r.text


# ---------- Loyalty flow ----------
def test_loyalty_credit_on_concluido(admin_token, member_token, servicos):
    # Create a fresh non-member client for loyalty test (member works too)
    tel = _rand_tel()
    reg = requests.post(f"{API}/auth/register", json={
        "nome": "TEST Loyalty", "telefone": tel, "senha": "senha123", "is_membro": True
    }, timeout=15).json()
    utok = reg["token"]
    uid = reg["user"]["id"]
    pts_before = reg["user"]["pontos_fidelidade"]

    # Book slot on Wednesday 15:00
    data = _next_weekday(2)
    ag = requests.post(f"{API}/agendamentos/", json={
        "servico_id": servicos[0]["id"], "data_hora_inicio": f"{data}T15:00:00"
    }, headers=_h(utok), timeout=15).json()
    aid = ag["id"]

    # Admin sets to Concluido
    r = requests.patch(f"{API}/agendamentos/{aid}/status", json={"status": "Concluido"},
                       headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "Concluido"

    # Verify points increased by 10
    me = requests.get(f"{API}/auth/me", headers=_h(utok), timeout=15).json()
    assert me["pontos_fidelidade"] == pts_before + 10

    # Second PATCH to same status should NOT credit again
    requests.patch(f"{API}/agendamentos/{aid}/status", json={"status": "Concluido"},
                   headers=_h(admin_token), timeout=15)
    me2 = requests.get(f"{API}/auth/me", headers=_h(utok), timeout=15).json()
    assert me2["pontos_fidelidade"] == pts_before + 10

    return uid, utok


# ---------- Voucher redemption ----------
def test_redeem_insufficient(nonmember_token):
    r = requests.post(f"{API}/fidelidade/resgatar/", headers=_h(nonmember_token), timeout=15)
    assert r.status_code == 400


def test_redeem_success(admin_token, servicos):
    # Create user and award them 100 pts via 10 completions
    tel = _rand_tel()
    reg = requests.post(f"{API}/auth/register", json={
        "nome": "TEST Redeem", "telefone": tel, "senha": "senha123", "is_membro": True
    }, timeout=15).json()
    utok = reg["token"]
    # Fast-path: directly bump via DB is not possible; create 10 appointments on consecutive weekdays
    # Instead: book 10 slots over 2 days then conclude all.
    booked_ids = []
    for day_offset in range(1, 4):  # Tue, Wed, Thu
        d = (date.today() + timedelta(days=((1 - date.today().weekday()) % 7) + day_offset - 1)).strftime("%Y-%m-%d")
        for hour in range(9, 13):  # 9,10,11,12 = 4 slots per day => 12 total, use first 10
            if len(booked_ids) >= 10:
                break
            ag = requests.post(f"{API}/agendamentos/", json={
                "servico_id": servicos[0]["id"],
                "data_hora_inicio": f"{d}T{hour:02d}:00:00"
            }, headers=_h(utok), timeout=15)
            if ag.status_code == 200:
                booked_ids.append(ag.json()["id"])
        if len(booked_ids) >= 10:
            break

    assert len(booked_ids) >= 10, f"Could only book {len(booked_ids)} slots"

    for aid in booked_ids[:10]:
        requests.patch(f"{API}/agendamentos/{aid}/status", json={"status": "Concluido"},
                       headers=_h(admin_token), timeout=15)

    me = requests.get(f"{API}/auth/me", headers=_h(utok), timeout=15).json()
    assert me["pontos_fidelidade"] >= 100

    r = requests.post(f"{API}/fidelidade/resgatar/", headers=_h(utok), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["valor_desconto"] == 20
    assert body["codigo"].startswith("WC-")
    assert body["pontos_restantes"] == me["pontos_fidelidade"] - 100


# ---------- Admin-only guards ----------
def test_status_requires_admin(member_token, booked_slot):
    r = requests.patch(f"{API}/agendamentos/{booked_slot['id']}/status",
                       json={"status": "Confirmado"},
                       headers=_h(member_token), timeout=15)
    assert r.status_code == 403
