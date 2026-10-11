let currentDecks = [];
let currentMaterials = [];
let currentDeck = null;
let currentCardIndex = 0;
let currentWrongContext = null;

document.addEventListener("DOMContentLoaded", () => {
  loadDecks();
  loadMaterials();
});

function switchView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  
  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add("active");
  
  const navEl = document.getElementById(`nav-${viewName}`);
  if (navEl) navEl.classList.add("active");
  
  if (viewName === "dashboard" || viewName === "decks") {
    loadDecks();
  } else if (viewName === "materials") {
    loadMaterials();
  }
}

async function loadDecks() {
  try {
    const res = await fetch("/api/decks");
    currentDecks = await res.json();
    renderDecks();
  } catch (err) {
    console.error("Failed to load decks", err);
  }
}

function renderDecks() {
  const grid = document.getElementById("decks-grid");
  const dashGrid = document.getElementById("dashboard-decks-grid");
  
  if (!currentDecks.length) {
    const emptyHtml = `<p style="color: var(--text-secondary);">No study decks yet. Click "+ Gen AI Deck" to create one!</p>`;
    if (grid) grid.innerHTML = emptyHtml;
    if (dashGrid) dashGrid.innerHTML = emptyHtml;
    return;
  }

  const html = currentDecks.map(deck => `
    <div class="card">
      <div>
        <span class="badge">${deck.category}</span>
        <h3>${deck.title}</h3>
        <p>${deck.description}</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">🃏 ${deck.cards.length} Cards &bull; By ${deck.creator}</p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn" onclick="startPractice('${deck.id}')" style="flex: 1;">Practice</button>
      </div>
    </div>
  `).join("");

  if (grid) grid.innerHTML = html;
  if (dashGrid) dashGrid.innerHTML = html;
}

async function loadMaterials() {
  try {
    const res = await fetch("/api/materials");
    currentMaterials = await res.json();
    renderMaterials();
    updateMaterialDropdown();
  } catch (err) {
    console.error("Failed to load materials", err);
  }
}

function renderMaterials() {
  const listEl = document.getElementById("materials-list");
  if (!currentMaterials.length) {
    listEl.innerHTML = `<p style="color: var(--text-secondary);">No study materials uploaded yet.</p>`;
    return;
  }

  listEl.innerHTML = currentMaterials.map(m => `
    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>📄 ${m.filename}</strong>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Chunks: ${m.chunk_count} &bull; Uploaded: ${new Date(m.uploaded_at).toLocaleDateString()}</p>
      </div>
      <span class="badge" style="background: #CCFBF1; color: #134E4A; margin-bottom: 0;">Indexed for RAG</span>
    </div>
  `).join("");
}

function updateMaterialDropdown() {
  const select = document.getElementById("gen-material");
  if (!select) return;
  
  let html = `<option value="">-- Use General Knowledge / All Materials --</option>`;
  currentMaterials.forEach(m => {
    html += `<option value="${m.id}">${m.filename} (${m.chunk_count} chunks)</option>`;
  });
  select.innerHTML = html;
}

async function uploadMaterial(event) {
  event.preventDefault();
  const fileInput = document.getElementById("material-file");
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/materials/upload", {
      method: "POST",
      body: formData
    });
    if (res.ok) {
      fileInput.value = "";
      loadMaterials();
      alert("Material successfully uploaded and indexed for RAG!");
    } else {
      alert("Failed to upload material.");
    }
  } catch (err) {
    console.error("Upload error", err);
    alert("Error uploading material.");
  }
}

function openGenModal() {
  document.getElementById("gen-modal").classList.add("active");
}

function closeGenModal() {
  document.getElementById("gen-modal").classList.remove("active");
}

async function generateDeck(event) {
  event.preventDefault();
  const topic = document.getElementById("gen-topic").value;
  const cardType = document.getElementById("gen-type").value;
  const count = parseInt(document.getElementById("gen-count").value);
  const materialId = document.getElementById("gen-material").value;

  closeGenModal();
  
  // Show loading indicator
  const grid = document.getElementById("decks-grid");
  if (grid) grid.innerHTML = `<p style="color: var(--accent); font-weight: 600;">Generating AI study deck with RAG context...</p>`;

  try {
    const res = await fetch("/api/decks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, card_type: cardType, count, material_id: materialId || null })
    });

    if (res.ok) {
      const deck = await res.json();
      loadDecks();
      startPractice(deck.id);
    } else {
      alert("Failed to generate deck.");
      loadDecks();
    }
  } catch (err) {
    console.error("Generation error", err);
    alert("Error generating deck.");
    loadDecks();
  }
}

function startPractice(deckId) {
  currentDeck = currentDecks.find(d => d.id === deckId);
  if (!currentDeck || !currentDeck.cards.length) {
    alert("This deck has no cards.");
    return;
  }
  currentCardIndex = 0;
  document.getElementById("practice-deck-title").innerText = currentDeck.title;
  switchView("practice");
  renderCard();
}

function renderCard() {
  if (!currentDeck || !currentDeck.cards.length) return;
  const card = currentDeck.cards[currentCardIndex];
  
  document.getElementById("practice-progress").innerText = `Card ${currentCardIndex + 1} of ${currentDeck.cards.length}`;
  
  const fcContainer = document.getElementById("flashcard-container");
  const mcqContainer = document.getElementById("mcq-container");
  
  if (card.type === "mcq") {
    fcContainer.style.display = "none";
    mcqContainer.style.display = "block";
    
    document.getElementById("mcq-question").innerText = card.question;
    const optionsEl = document.getElementById("mcq-options");
    
    optionsEl.innerHTML = (card.options || [card.answer, "Option B", "Option C", "Option D"]).map(opt => `
      <div class="mcq-option" onclick="checkMcqAnswer('${escapeQuote(opt)}', '${escapeQuote(card.answer)}', '${escapeQuote(card.question)}')">${opt}</div>
    `).join("");
  } else {
    fcContainer.style.display = "flex";
    mcqContainer.style.display = "none";
    
    fcContainer.classList.remove("revealed");
    document.getElementById("fc-question").innerText = card.question;
    document.getElementById("fc-answer").innerText = card.answer;
  }
}

function flipFlashcard() {
  const fcContainer = document.getElementById("flashcard-container");
  fcContainer.classList.toggle("revealed");
}

function checkMcqAnswer(selected, correct, question) {
  const optionsEl = document.getElementById("mcq-options");
  const opts = optionsEl.querySelectorAll(".mcq-option");
  
  opts.forEach(el => {
    el.style.pointerEvents = "none";
    if (el.innerText.trim() === correct.trim()) {
      el.classList.add("correct");
    } else if (el.innerText.trim() === selected.trim() && selected.trim() !== correct.trim()) {
      el.classList.add("incorrect");
    }
  });

  if (selected.trim() === correct.trim()) {
    // Correct! Wait 1.2s and go next
    setTimeout(() => {
      nextCard();
    }, 1200);
  } else {
    // Incorrect! Trigger AI Explainer modal
    currentWrongContext = {
      question,
      user_answer: selected,
      correct_answer: correct
    };
    setTimeout(() => {
      openExplainerModal();
    }, 600);
  }
}

function nextCard() {
  if (!currentDeck) return;
  currentCardIndex = (currentCardIndex + 1) % currentDeck.cards.length;
  renderCard();
}

function prevCard() {
  if (!currentDeck) return;
  currentCardIndex = (currentCardIndex - 1 + currentDeck.cards.length) % currentDeck.cards.length;
  renderCard();
}

let currentHintLevel = 1;

const HINT_LEVEL_LABELS = {
  1: "Level 1 of 4: Guiding Question",
  2: "Level 2 of 4: Conceptual Hint",
  3: "Level 3 of 4: Partial Worked Step",
  4: "Level 4 of 4: Full Explanation"
};

function openExplainerModal() {
  if (!currentWrongContext) return;
  currentHintLevel = 1;
  const attemptInput = document.getElementById("hint-learner-attempt");
  if (attemptInput) attemptInput.value = "";
  document.getElementById("explainer-question-title").innerText = currentWrongContext.question;
  document.getElementById("explainer-summary").innerText = `You answered "${currentWrongContext.user_answer}".`;
  document.getElementById("explainer-modal").classList.add("active");
  fetchAiExplanation(1);
}

function closeExplainerModal() {
  document.getElementById("explainer-modal").classList.remove("active");
}

function giveNextHint() {
  if (currentHintLevel < 4) {
    currentHintLevel += 1;
    fetchAiExplanation(currentHintLevel);
  }
}

function showFullExplanation() {
  currentHintLevel = 4;
  fetchAiExplanation(4);
}

async function fetchAiExplanation(hintLevel = currentHintLevel) {
  if (!currentWrongContext) return;
  currentHintLevel = hintLevel;
  const level = document.getElementById("understanding-level").value;
  const explainerText = document.getElementById("explainer-text");
  const explainerHeader = document.getElementById("explainer-header");
  const badgeEl = document.getElementById("hint-level-badge");
  const giveHintBtn = document.getElementById("btn-give-hint");
  const attemptInput = document.getElementById("hint-learner-attempt");
  const learnerAttempt = attemptInput ? attemptInput.value.trim() : "";

  if (badgeEl) {
    badgeEl.innerText = HINT_LEVEL_LABELS[hintLevel] || `Level ${hintLevel}`;
    badgeEl.style.background = hintLevel === 4 ? "#FEE2E2" : "#CCFBF1";
    badgeEl.style.color = hintLevel === 4 ? "#991B1B" : "#134E4A";
  }

  if (explainerHeader) {
    explainerHeader.innerText = hintLevel === 4 
      ? "AI Tutor Full Explanation:" 
      : `AI Tutor Hint (${HINT_LEVEL_LABELS[hintLevel]}):`;
  }

  if (giveHintBtn) {
    if (hintLevel < 4) {
      giveHintBtn.disabled = false;
      giveHintBtn.innerText = `Give me a hint (Level ${hintLevel + 1})`;
    } else {
      giveHintBtn.disabled = true;
      giveHintBtn.innerText = "Full explanation reached";
    }
  }

  explainerText.innerText = "Consulting EduCards AI tutor...";

  try {
    const res = await fetch("/api/ai/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: currentWrongContext.question,
        user_answer: currentWrongContext.user_answer,
        correct_answer: currentWrongContext.correct_answer,
        understanding_level: level,
        hint_level: hintLevel,
        learner_attempt: learnerAttempt || undefined
      })
    });

    if (res.ok) {
      const data = await res.json();
      explainerText.innerText = data.explanation;
    } else {
      explainerText.innerText = "Unable to fetch AI explanation at this moment.";
    }
  } catch (err) {
    console.error("Explainer error", err);
    explainerText.innerText = "Error connecting to AI explainer service.";
  }
}

function escapeQuote(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
