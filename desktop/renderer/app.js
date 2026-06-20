const api = window.codexBridge;
let state = null;
let draftSelection = [];

const els = {
  routerStatus: document.querySelector("#routerStatus"),
  modeStatus: document.querySelector("#modeStatus"),
  rootDir: document.querySelector("#rootDir"),
  selectedCount: document.querySelector("#selectedCount"),
  maxModels: document.querySelector("#maxModels"),
  keySummary: document.querySelector("#keySummary"),
  providerGrid: document.querySelector("#providerGrid"),
  selectedModels: document.querySelector("#selectedModels"),
  modelPool: document.querySelector("#modelPool"),
  logOutput: document.querySelector("#logOutput"),
  toast: document.querySelector("#toast"),
  customModelForm: document.querySelector("#customModelForm"),
};

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".section-panel").forEach((section) => section.classList.add("hidden"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.section}`).classList.remove("hidden");
  });
});

document.querySelectorAll(".mode-card").forEach((button) => {
  button.addEventListener("click", () =>
    runAction(button, "正在切换模式...", async () => {
      state = await api.selectMode(button.dataset.mode);
      draftSelection = [...state.selectedModelIds];
      render();
      showToast("模式已切换，并已生成对应模型配置。");
    }),
  );
});

document.querySelector("#saveSecrets").addEventListener("click", (event) =>
  runAction(event.currentTarget, "正在保存密钥...", async () => {
    const secrets = {};
    document.querySelectorAll("[data-key-env]").forEach((input) => {
      if (input.value.trim()) {
        secrets[input.dataset.keyEnv] = input.value.trim();
      }
    });
    await api.saveSecrets(secrets);
    document.querySelectorAll("[data-key-env]").forEach((input) => {
      input.value = "";
    });
    await refresh();
    showToast("密钥已保存。");
  }),
);

document.querySelectorAll("#saveModelSelection, #saveModelSelectionPanel").forEach((button) => {
  button.addEventListener("click", () => saveModelSelection(button));
});

document.querySelector("#generateCatalog").addEventListener("click", (event) =>
  runAction(event.currentTarget, "正在生成模型目录...", async () => {
    const result = await api.generateCatalog();
    if (!result.ok) {
      throw new Error(result.output || "生成模型目录失败");
    }
    await refresh();
    showToast("模型目录已生成。");
  }),
);

document.querySelector("#applyCodex").addEventListener("click", (event) =>
  runAction(event.currentTarget, "正在写入 Codex 配置...", async () => {
    const result = await api.applyCodexConfig();
    await refresh();
    showToast(result.backup ? "Codex 配置已写入，旧配置已备份。" : "Codex 配置已写入。");
  }),
);

document.querySelector("#startRouter").addEventListener("click", (event) =>
  runAction(event.currentTarget, "正在启动 Router...", async () => {
    await api.startRouter();
    await refresh();
    showToast("Router 已启动。");
  }),
);

document.querySelector("#stopRouter").addEventListener("click", (event) =>
  runAction(event.currentTarget, "正在停止 Router...", async () => {
    await api.stopRouter();
    await refresh();
    showToast("Router 已停止。");
  }),
);

els.customModelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(els.customModelForm.querySelector("button"), "正在添加模型...", async () => {
    const model = {
      providerName: value("#customProviderName"),
      displayName: value("#customDisplayName"),
      model: value("#customModelName"),
      baseUrl: value("#customBaseUrl"),
      keyUrl: value("#customKeyUrl"),
      api: value("#customApiType"),
    };
    await api.saveCustomModel(model);
    els.customModelForm.reset();
    await refresh();
    showToast("自定义模型已添加。");
  });
});

document.querySelector("#openConfigFolder").addEventListener("click", () => api.openFolder("config"));
document.querySelector("#openCodexFolder").addEventListener("click", () => api.openFolder("codex"));
document.querySelector("#openGitHub").addEventListener("click", () => api.openGitHub());

api.onLogs((logs) => renderLogs(logs));
api.onState((nextState) => {
  state = nextState;
  draftSelection = [...(state.selectedModelIds || [])];
  render();
});

refresh();

async function refresh() {
  state = await api.getState();
  draftSelection = [...(state.selectedModelIds || [])];
  render();
}

function render() {
  if (!state) {
    return;
  }

  els.routerStatus.textContent = state.routerRunning ? "Router 运行中" : "Router 未启动";
  els.routerStatus.classList.toggle("muted", !state.routerRunning);
  els.modeStatus.textContent = state.mode === "hybrid" ? "混合模式" : "全部 API";
  els.modeStatus.classList.toggle("muted", false);
  els.rootDir.textContent = state.rootDir;
  els.selectedCount.textContent = String(draftSelection.length);
  els.maxModels.textContent = String(state.maxModels || 5);
  els.keySummary.textContent = summarizeKeys();

  document.querySelectorAll(".mode-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  renderProviders();
  renderSelectedModels();
  renderModelPool();
  renderLogs(state.logs || []);
}

function renderProviders() {
  const cards = state.providers.map((provider) => {
    const saved = provider.keyEnv ? Boolean(state.secretStatus?.[provider.keyEnv]) : true;
    const status = provider.keyEnv ? (saved ? "已保存" : "未保存") : "无需 Key";
    const input = provider.keyEnv
      ? `<input type="password" data-key-env="${escapeHtml(provider.keyEnv)}" placeholder="${saved ? "已保存，留空则不修改" : "sk-..."}" />`
      : `<div class="no-key">使用 Codex 登录态，无需在这里填写 API Key。</div>`;
    const keyButton = provider.keyUrl
      ? `<button class="plain-button small" data-open-url="${escapeHtml(provider.keyUrl)}">获取 API Key</button>`
      : "";
    return `
      <article class="provider-card">
        <div class="provider-head">
          <div>
            <h3>${escapeHtml(provider.name)}</h3>
            <p>${escapeHtml(provider.description || "")}</p>
          </div>
          <span class="tag ${saved ? "ok" : ""}">${status}</span>
        </div>
        <label>
          <span>${escapeHtml(provider.keyLabel || "API Key")}</span>
          ${input}
        </label>
        <div class="provider-actions">
          ${keyButton}
          ${provider.docsUrl ? `<button class="ghost-button light small" data-open-url="${escapeHtml(provider.docsUrl)}">文档</button>` : ""}
        </div>
      </article>
    `;
  });
  els.providerGrid.innerHTML = cards.join("");
  els.providerGrid.querySelectorAll("[data-open-url]").forEach((button) => {
    button.addEventListener("click", () => api.openExternal(button.dataset.openUrl));
  });
}

function renderSelectedModels() {
  const modelsById = modelMap();
  els.selectedModels.innerHTML = (state.modelSlots || [])
    .map((slot, index) => {
      const model = modelsById.get(draftSelection[index]);
      return `
        <div class="slot-card ${model ? "filled" : ""}">
          <span>${escapeHtml(slot.label)}</span>
          <strong>${model ? escapeHtml(model.displayName) : "未选择"}</strong>
          <small>${model ? escapeHtml(providerName(model.providerId)) : "最多显示 5 个"}</small>
        </div>
      `;
    })
    .join("");
}

function renderModelPool() {
  const selected = new Set(draftSelection);
  const max = Number(state.maxModels || 5);
  const grouped = groupByProvider(state.modelPresets || []);
  els.modelPool.innerHTML = grouped
    .map(([providerId, models]) => {
      const provider = providerFor(providerId);
      return `
        <section class="model-group">
          <div class="model-group-title">
            <h3>${escapeHtml(provider?.name || providerId)}</h3>
            <span>${models.length} 个模型</span>
          </div>
          <div class="model-card-grid">
            ${models.map((model) => modelCard(model, selected, max)).join("")}
          </div>
        </section>
      `;
    })
    .join("");

  els.modelPool.querySelectorAll("[data-model-id]").forEach((button) => {
    button.addEventListener("click", () => toggleModel(button.dataset.modelId));
  });
  els.modelPool.querySelectorAll("[data-remove-custom]").forEach((button) => {
    button.addEventListener("click", () =>
      runAction(button, "正在删除模型...", async () => {
        state = await api.removeCustomModel(button.dataset.removeCustom);
        draftSelection = [...state.selectedModelIds];
        render();
        showToast("自定义模型已删除。");
      }),
    );
  });
}

function modelCard(model, selected, max) {
  const isSelected = selected.has(model.presetId);
  const isNativeDisabled = state.mode === "all_api" && model.authMode === "codex_openai";
  const isMaxed = !isSelected && draftSelection.length >= max;
  const disabled = isNativeDisabled || isMaxed;
  const reason = isNativeDisabled
    ? "全部 API 模式不能选订阅模型"
    : isMaxed
      ? "已选满 5 个"
      : providerName(model.providerId);
  return `
    <button class="model-card ${isSelected ? "selected" : ""}" data-model-id="${escapeHtml(model.presetId)}" ${disabled ? "disabled" : ""}>
      <span class="model-title">${escapeHtml(model.displayName)}</span>
      <span class="model-meta">${escapeHtml(model.model)} · ${escapeHtml(model.api)}</span>
      <span class="model-foot">${escapeHtml(reason)}</span>
    </button>
    ${model.custom ? `<button class="text-button remove-model" data-remove-custom="${escapeHtml(model.presetId)}">删除 ${escapeHtml(model.displayName)}</button>` : ""}
  `;
}

function toggleModel(presetId) {
  const max = Number(state.maxModels || 5);
  if (draftSelection.includes(presetId)) {
    draftSelection = draftSelection.filter((id) => id !== presetId);
  } else if (draftSelection.length < max) {
    draftSelection = [...draftSelection, presetId];
  } else {
    showToast("Codex 模型栏最多只能显示 5 个。", "error");
  }
  render();
}

function saveModelSelection(button) {
  return runAction(button, "正在保存模型选择...", async () => {
    state = await api.saveModelSelection(draftSelection);
    draftSelection = [...state.selectedModelIds];
    render();
    showToast("模型选择已保存。");
  });
}

async function runAction(button, pendingText, fn) {
  const oldText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = pendingText;
    }
    await fn();
  } catch (error) {
    const message = error?.message || String(error);
    showToast(message, "error");
    console.error(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
}

function summarizeKeys() {
  const needed = new Set();
  const modelsById = modelMap();
  for (const id of draftSelection) {
    const model = modelsById.get(id);
    const provider = providerFor(model?.providerId);
    if (model?.authMode === "api_key" && (model.apiKeyEnv || model.keyEnv || provider?.keyEnv)) {
      needed.add(model.apiKeyEnv || model.keyEnv || provider.keyEnv);
    }
  }
  const saved = [...needed].filter((key) => state.secretStatus?.[key]).length;
  return `${saved}/${needed.size} 个所选模型密钥已保存`;
}

function renderLogs(logs) {
  els.logOutput.textContent = logs.length
    ? logs.join("\n")
    : "暂无日志。启动 Router 或点击操作按钮后，这里会显示执行结果。";
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3600);
}

function groupByProvider(models) {
  const groups = new Map();
  for (const model of models) {
    if (!groups.has(model.providerId)) {
      groups.set(model.providerId, []);
    }
    groups.get(model.providerId).push(model);
  }
  return [...groups.entries()];
}

function providerFor(providerId) {
  return (state.providers || []).find((provider) => provider.id === providerId);
}

function providerName(providerId) {
  return providerFor(providerId)?.shortName || providerFor(providerId)?.name || providerId || "-";
}

function modelMap() {
  return new Map((state.modelPresets || []).map((model) => [model.presetId, model]));
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
