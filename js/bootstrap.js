import { exigirAplicativoAtero } from "./access-guard.js?v=1";

function mostrarFalhaInicializacao(error) {
  console.error("Erro ao iniciar o Atero Calendar:", error);
  document.documentElement.dataset.accessState = "authorized";
  const root = document.querySelector("#calendar-root");
  if (root) {
    root.innerHTML = `
      <div class="calendar-error-state">
        <div class="calendar-error-card">
          <h2>O Calendar não conseguiu iniciar</h2>
          <p>Atualize a página. Se o problema continuar, verifique o console do navegador.</p>
          <button class="primary-button" type="button" onclick="window.location.reload()">Recarregar</button>
        </div>
      </div>`;
  }
}

async function iniciar() {
  const acesso = await exigirAplicativoAtero({ appId: "calendar", nomeFallback: "Atero Calendar" });
  if (!acesso) return;
  try {
    const modulo = await import("./app.js?v=4");
    await modulo.iniciarAplicativo({ usuario: acesso.user, aplicativo: acesso.app });
  } catch (error) {
    mostrarFalhaInicializacao(error);
  }
}

iniciar();
