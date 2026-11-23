import { createAuthClient } from "@neon/auth";

const AUTH_URL = "https://ep-muddy-unit-bb5hu0pg.neonauth.c-15.us-east-1.aws.neon.tech/steelco/auth";
const PRICE_CACHE_KEY = "steelco-square-meter-price-cache";
const authClient = createAuthClient(AUTH_URL);

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const elements = {
  area: document.querySelector("#area"),
  areaError: document.querySelector("#areaError"),
  authPanel: document.querySelector("#authPanel"),
  backToSignIn: document.querySelector("#backToSignIn"),
  calculateButton: document.querySelector("#calculateButton"),
  closeEmployee: document.querySelector("#closeEmployee"),
  confirmResetError: document.querySelector("#confirmResetError"),
  confirmResetForm: document.querySelector("#confirmResetForm"),
  editEstimate: document.querySelector("#editEstimate"),
  employeeIdentity: document.querySelector("#employeeIdentity"),
  employeeLoading: document.querySelector("#employeeLoading"),
  employeeModal: document.querySelector("#employeeModal"),
  employeePanel: document.querySelector("#employeePanel"),
  estimateForm: document.querySelector("#estimateForm"),
  estimateResult: document.querySelector("#estimateResult"),
  formulaArea: document.querySelector("#formulaArea"),
  formulaPrice: document.querySelector("#formulaPrice"),
  heroMetric: document.querySelector("#heroMetric"),
  installApp: document.querySelector("#installApp"),
  newPassword: document.querySelector("#newPassword"),
  openEmployee: document.querySelector("#openEmployee"),
  passwordResetPanel: document.querySelector("#passwordResetPanel"),
  priceError: document.querySelector("#priceError"),
  priceForm: document.querySelector("#priceForm"),
  priceStatus: document.querySelector("#priceStatus"),
  publicPrice: document.querySelector("#publicPrice"),
  pwaStatus: document.querySelector("#pwaStatus"),
  requestResetError: document.querySelector("#requestResetError"),
  requestResetForm: document.querySelector("#requestResetForm"),
  resetCode: document.querySelector("#resetCode"),
  resetEmail: document.querySelector("#resetEmail"),
  resultTotal: document.querySelector("#resultTotal"),
  savedFeedback: document.querySelector("#savedFeedback"),
  showSignIn: document.querySelector("#showSignIn"),
  showSignUp: document.querySelector("#showSignUp"),
  showPasswordReset: document.querySelector("#showPasswordReset"),
  signInEmail: document.querySelector("#signInEmail"),
  signInError: document.querySelector("#signInError"),
  signInForm: document.querySelector("#signInForm"),
  signInPassword: document.querySelector("#signInPassword"),
  signOutButton: document.querySelector("#signOutButton"),
  signUpEmail: document.querySelector("#signUpEmail"),
  signUpError: document.querySelector("#signUpError"),
  signUpForm: document.querySelector("#signUpForm"),
  signUpName: document.querySelector("#signUpName"),
  signUpPassword: document.querySelector("#signUpPassword"),
  squareMeterPrice: document.querySelector("#squareMeterPrice"),
  unauthorizedMessage: document.querySelector("#unauthorizedMessage"),
  unauthorizedPanel: document.querySelector("#unauthorizedPanel"),
  unauthorizedSignOut: document.querySelector("#unauthorizedSignOut"),
};

let configuredPrice = null;
let priceState = "loading";
let lastFocusedElement = null;
let deferredInstallPrompt = null;
let pwaToastTimer = null;
let activeAuthToken = null;

function parseBrazilianNumber(value) {
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function readCachedPrice() {
  try {
    const cached = Number(localStorage.getItem(PRICE_CACHE_KEY));
    return Number.isFinite(cached) && cached > 0 ? cached : null;
  } catch {
    return null;
  }
}

function cachePrice(price) {
  try {
    if (price === null) localStorage.removeItem(PRICE_CACHE_KEY);
    else localStorage.setItem(PRICE_CACHE_KEY, String(price));
  } catch {
    // O cache local é apenas uma conveniência offline; o banco continua sendo a fonte oficial.
  }
}

function updatePriceUI() {
  const hasPrice = configuredPrice !== null;
  elements.calculateButton.disabled = !hasPrice;
  elements.priceStatus.classList.toggle("configured", hasPrice);

  if (priceState === "loading") {
    elements.publicPrice.textContent = "Carregando valor atual…";
  } else if (hasPrice) {
    const suffix = priceState === "cached" ? " · último valor salvo" : "";
    elements.publicPrice.textContent = `${moneyFormatter.format(configuredPrice)} / m²${suffix}`;
  } else if (priceState === "error") {
    elements.publicPrice.textContent = "Valor indisponível no momento";
  } else {
    elements.publicPrice.textContent = "Aguardando configuração da equipe";
  }

  elements.squareMeterPrice.value = hasPrice
    ? configuredPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
}

async function loadPrice() {
  priceState = "loading";
  updatePriceUI();

  try {
    const response = await fetch("/api/price", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao carregar o valor.");

    configuredPrice = Number.isFinite(Number(data.price)) && Number(data.price) > 0
      ? Number(data.price)
      : null;
    priceState = "ready";
    cachePrice(configuredPrice);
  } catch {
    configuredPrice = readCachedPrice();
    priceState = configuredPrice === null ? "error" : "cached";
  }

  updatePriceUI();
}

function setEmployeeView(view) {
  elements.employeeLoading.hidden = view !== "loading";
  elements.authPanel.hidden = view !== "auth";
  elements.passwordResetPanel.hidden = view !== "reset";
  elements.employeePanel.hidden = view !== "employee";
  elements.unauthorizedPanel.hidden = view !== "unauthorized";
}

function setAuthMode(mode) {
  const isSignIn = mode === "signin";
  elements.signInForm.hidden = !isSignIn;
  elements.signUpForm.hidden = isSignIn;
  elements.showSignIn.classList.toggle("active", isSignIn);
  elements.showSignUp.classList.toggle("active", !isSignIn);
  elements.showSignIn.setAttribute("aria-selected", String(isSignIn));
  elements.showSignUp.setAttribute("aria-selected", String(!isSignIn));
  elements.signInError.textContent = "";
  elements.signUpError.textContent = "";
  window.setTimeout(() => (isSignIn ? elements.signInEmail : elements.signUpName).focus(), 20);
}

function showEmployee(employee, fallbackEmail = "") {
  elements.employeeIdentity.textContent = employee?.name || employee?.email || fallbackEmail;
  setEmployeeView("employee");
  window.setTimeout(() => elements.squareMeterPrice.focus(), 20);
}

async function getAuthToken() {
  if (isTokenFresh(activeAuthToken)) return activeAuthToken;

  const tokenResult = await authClient.token();
  if (!tokenResult.error && tokenResult.data?.token) {
    activeAuthToken = tokenResult.data.token;
    return activeAuthToken;
  }

  const sessionResult = await authClient.getSession();
  const sessionToken = sessionResult.data?.session?.token;
  if (sessionResult.error || !sessionToken) throw new Error("Não foi possível validar a sessão.");
  activeAuthToken = sessionToken;
  return activeAuthToken;
}

function isTokenFresh(token) {
  if (!token) return false;

  try {
    const payloadPart = token.split(".")[1];
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    return Number(payload.exp) * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

async function verifyEmployee(user, loginToken = null) {
  if (isTokenFresh(loginToken)) activeAuthToken = loginToken;
  const token = await getAuthToken();
  const response = await fetch("/api/employee", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "Acesso não autorizado.");
    error.status = response.status;
    throw error;
  }

  showEmployee(data.employee, user.email);
}

async function refreshEmployeeView() {
  setEmployeeView("loading");
  elements.savedFeedback.hidden = true;
  elements.priceError.textContent = "";

  try {
    const { data, error } = await authClient.getSession();
    const user = data?.user;
    if (error || !user) {
      setEmployeeView("auth");
      setAuthMode("signin");
      return;
    }

    await verifyEmployee(user, data.session?.token);
  } catch (error) {
    if (error.status === 403) {
      elements.unauthorizedMessage.textContent = error.message;
      setEmployeeView("unauthorized");
      return;
    }

    await authClient.signOut().catch(() => {});
    elements.signInError.textContent = error.message || "Sua sessão expirou. Entre novamente.";
    setEmployeeView("auth");
  }
}

function openEmployeeModal() {
  lastFocusedElement = document.activeElement;
  elements.employeeModal.hidden = false;
  document.body.classList.add("modal-open");
  refreshEmployeeView();
}

function closeEmployeeModal() {
  elements.employeeModal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastFocusedElement) lastFocusedElement.focus();
}

function showEstimate(area) {
  const total = area * configuredPrice;
  elements.resultTotal.textContent = moneyFormatter.format(total);
  elements.formulaArea.textContent = `${numberFormatter.format(area)} m²`;
  elements.formulaPrice.textContent = `${moneyFormatter.format(configuredPrice)} / m²`;
  elements.heroMetric.textContent = `${numberFormatter.format(area)} m² · ${moneyFormatter.format(total)}`;
  elements.estimateForm.hidden = true;
  elements.estimateResult.hidden = false;
}

function showPwaStatus(message) {
  window.clearTimeout(pwaToastTimer);
  elements.pwaStatus.textContent = message;
  elements.pwaStatus.hidden = false;
  pwaToastTimer = window.setTimeout(() => {
    elements.pwaStatus.hidden = true;
  }, 4200);
}

function setFormPending(form, pending) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = pending;
  button.setAttribute("aria-busy", String(pending));
}

function authErrorMessage(error, fallback) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid") || message.includes("credential")) return "E-mail ou senha incorretos. Se necessário, use “Esqueci minha senha”.";
  if (message.includes("already") || message.includes("exist")) return "Este e-mail já possui uma conta. Use a opção Entrar.";
  if (message.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (message.includes("validar a sessão")) return "O login foi aceito, mas o aplicativo não conseguiu concluir a sessão. Feche o PWA, abra novamente e tente entrar.";
  return fallback;
}

function openPasswordReset() {
  elements.requestResetError.textContent = "";
  elements.confirmResetError.textContent = "";
  elements.requestResetForm.hidden = false;
  elements.confirmResetForm.hidden = true;
  elements.resetCode.value = "";
  elements.newPassword.value = "";
  if (elements.signInEmail.value.trim()) elements.resetEmail.value = elements.signInEmail.value.trim();
  setEmployeeView("reset");
  window.setTimeout(() => elements.resetEmail.focus(), 20);
}

function backToSignIn() {
  setEmployeeView("auth");
  setAuthMode("signin");
}

elements.estimateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.areaError.textContent = "";

  if (!configuredPrice) {
    elements.areaError.textContent = "A equipe ainda precisa configurar o valor do m².";
    return;
  }

  const area = parseBrazilianNumber(elements.area.value);
  if (!Number.isFinite(area) || area <= 0) {
    elements.areaError.textContent = "Informe uma área válida maior que zero.";
    elements.area.focus();
    return;
  }

  if (area > 100000) {
    elements.areaError.textContent = "Confira a metragem informada; o limite para esta estimativa é 100.000 m².";
    elements.area.focus();
    return;
  }

  showEstimate(area);
});

elements.signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.signInError.textContent = "";
  const email = elements.signInEmail.value.trim().toLowerCase();
  const password = elements.signInPassword.value;

  if (!email || !password) {
    elements.signInError.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  setFormPending(elements.signInForm, true);
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data?.token || !data?.employee) {
      const error = new Error(data?.error || "Não foi possível entrar.");
      error.status = response.status;
      throw error;
    }

    activeAuthToken = data.token;
    showEmployee(data.employee, email);
    elements.signInPassword.value = "";
  } catch (error) {
    if (error?.status === 403) {
      elements.unauthorizedMessage.textContent = error.message;
      setEmployeeView("unauthorized");
    } else {
      elements.signInError.textContent = authErrorMessage(error, "Não foi possível entrar. Confira os dados e tente novamente.");
    }
  } finally {
    setFormPending(elements.signInForm, false);
  }
});

elements.signUpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.signUpError.textContent = "";
  const name = elements.signUpName.value.trim();
  const email = elements.signUpEmail.value.trim().toLowerCase();
  const password = elements.signUpPassword.value;

  if (!name || !email || password.length < 8) {
    elements.signUpError.textContent = "Informe nome, e-mail e uma senha com pelo menos 8 caracteres.";
    return;
  }

  setFormPending(elements.signUpForm, true);
  try {
    const { data, error } = await authClient.signUp.email({ name, email, password });
    if (error || !data?.user) throw error || new Error("Não foi possível criar a conta.");
    await verifyEmployee(data.user, data.session?.token);
    elements.signUpPassword.value = "";
  } catch (error) {
    if (error?.status === 403) {
      elements.unauthorizedMessage.textContent = error.message;
      setEmployeeView("unauthorized");
    } else {
      elements.signUpError.textContent = authErrorMessage(error, "Não foi possível criar o acesso. Tente novamente.");
    }
  } finally {
    setFormPending(elements.signUpForm, false);
  }
});

elements.requestResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.requestResetError.textContent = "";
  const email = elements.resetEmail.value.trim().toLowerCase();
  if (!email) {
    elements.requestResetError.textContent = "Informe seu e-mail.";
    return;
  }

  setFormPending(elements.requestResetForm, true);
  try {
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    if (error) throw error;
    elements.requestResetForm.hidden = true;
    elements.confirmResetForm.hidden = false;
    window.setTimeout(() => elements.resetCode.focus(), 20);
  } catch {
    elements.requestResetError.textContent = "Não foi possível enviar o código agora. Tente novamente em instantes.";
  } finally {
    setFormPending(elements.requestResetForm, false);
  }
});

elements.confirmResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.confirmResetError.textContent = "";
  const email = elements.resetEmail.value.trim().toLowerCase();
  const otp = elements.resetCode.value.trim();
  const password = elements.newPassword.value;

  if (!otp || password.length < 8) {
    elements.confirmResetError.textContent = "Informe o código recebido e uma senha com pelo menos 8 caracteres.";
    return;
  }

  setFormPending(elements.confirmResetForm, true);
  try {
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    if (error) throw error;
    elements.signInEmail.value = email;
    elements.signInPassword.value = "";
    backToSignIn();
    showPwaStatus("Senha alterada. Entre com a nova senha.");
  } catch {
    elements.confirmResetError.textContent = "Código inválido ou expirado. Solicite um novo código e tente novamente.";
  } finally {
    setFormPending(elements.confirmResetForm, false);
  }
});

elements.priceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.priceError.textContent = "";
  elements.savedFeedback.hidden = true;

  const newPrice = parseBrazilianNumber(elements.squareMeterPrice.value);
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    elements.priceError.textContent = "Informe um valor por m² maior que zero.";
    elements.squareMeterPrice.focus();
    return;
  }

  if (newPrice > 1000000) {
    elements.priceError.textContent = "Confira o valor informado; ele parece acima do esperado.";
    elements.squareMeterPrice.focus();
    return;
  }

  setFormPending(elements.priceForm, true);
  try {
    const token = await getAuthToken();
    const response = await fetch("/api/price", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ price: newPrice }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Não foi possível salvar o valor.");
      error.status = response.status;
      throw error;
    }

    configuredPrice = Number(data.price);
    priceState = "ready";
    cachePrice(configuredPrice);
    updatePriceUI();
    elements.savedFeedback.hidden = false;
    window.setTimeout(closeEmployeeModal, 1250);
  } catch (error) {
    elements.priceError.textContent = error.message || "Não foi possível salvar o valor.";
    if (error.status === 401 || error.status === 403) window.setTimeout(refreshEmployeeView, 700);
  } finally {
    setFormPending(elements.priceForm, false);
  }
});

async function signOutAndReset() {
  activeAuthToken = null;
  await authClient.signOut().catch(() => {});
  elements.signInPassword.value = "";
  elements.signUpPassword.value = "";
  setEmployeeView("auth");
  setAuthMode("signin");
}

elements.showSignIn.addEventListener("click", () => setAuthMode("signin"));
elements.showSignUp.addEventListener("click", () => setAuthMode("signup"));
elements.showPasswordReset.addEventListener("click", openPasswordReset);
elements.backToSignIn.addEventListener("click", backToSignIn);
elements.signOutButton.addEventListener("click", signOutAndReset);
elements.unauthorizedSignOut.addEventListener("click", signOutAndReset);

elements.editEstimate.addEventListener("click", () => {
  elements.estimateResult.hidden = true;
  elements.estimateForm.hidden = false;
  elements.area.focus();
});

elements.openEmployee.addEventListener("click", openEmployeeModal);
elements.closeEmployee.addEventListener("click", closeEmployeeModal);

elements.employeeModal.addEventListener("click", (event) => {
  if (event.target === elements.employeeModal) closeEmployeeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.employeeModal.hidden) closeEmployeeModal();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=10").catch(() => {
      showPwaStatus("O modo offline não pôde ser ativado neste navegador.");
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installApp.hidden = false;
});

elements.installApp.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showPwaStatus("Use o menu do navegador e escolha “Instalar aplicativo”.");
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installApp.hidden = true;

  if (outcome === "accepted") {
    showPwaStatus("Steel & Co. foi adicionada aos seus aplicativos.");
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.installApp.hidden = true;
  showPwaStatus("Aplicativo instalado com sucesso.");
});

updatePriceUI();
loadPrice();
