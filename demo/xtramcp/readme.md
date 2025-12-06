# XtraMCP Server – Orchestration Prompts

XtraMCP is a **custom MCP-based orchestration server** that powers PaperDebugger’s higher-level workflows:

- 🧑‍🔬 **Researcher** – find and position your work within the literature  
- 🧑‍⚖️ **Reviewer** – critique drafts like a top-tier ML reviewer  
- ✍️ **Enhancer** – perform fine-grained, context-aware rewrites  
- 🧾 **Conference Formatter** (WIP) – adapt drafts to conference templates (NeurIPS, ICLR, AAAI, etc.)

This document describes the core tools exposed by XtraMCP and how they combine into these workflows.

> **Note:** XtraMCP is currently **closed-source** while the API and deployment story stabilize.  
> PaperDebugger runs fully without it; connecting XtraMCP unlocks the advanced research/review pipelines described here.

---

## Tool Overview

| Tool Name                  | Role       | Purpose                                                         | Primary Data Source         |
|---------------------------|-----------|-----------------------------------------------------------------|-----------------------------|
| `search_relevant_papers`  | Researcher | Fast semantic search over recent CS papers in a local vector DB, enhanced with semantic re-ranker module | Local vector database       |
| `deep_research`           | Researcher | Multi-step literature synthesis & positioning of your draft     | Local DB + retrieved papers |
| `online_search_papers`    | Researcher | Online search over external academic corpora                    | OpenReview + arXiv          |
| `review_paper`            | Reviewer   | Conference-style structured review of a draft                   | Your draft                  |
| `enhance_academic_writing`| Enhancer   | Context-aware rewriting and polishing of selected text          | Your draft + XtraGPT        |
| `get_user_papers`| Misc | Fetch all papers, alongside description, published (OpenReview) by a specific user identified by email | User's email address

---

## 1. `search_relevant_papers`

**Purpose:**  
Search for similar or relevant papers by keywords or extracted concepts against a **local database of academic papers**.<br>This tool uses semantic search with vector embeddings to find the most relevant results, enhanced with a re-ranker module to better capture nuance. It is fast and the default and recommended tool for paper searches.

**How it works:**

- Recent CS papers (last few years) are **vectorized** into a local index.
- Queries (from your topic or draft) are embedded and matched via **similarity search**.
- Results are reranked by an **LLM-based reranker** for better semantic alignment.

**Typical usage:**

- “Find the 10 most relevant papers to this draft.”  
- “Search for relevant works on diffusion models for imbalanced medical imaging.”

---

## 2. `deep_research`

**Purpose:**  
Given a **research topic or draft paper**, perform multi-step literature exploration and synthesis. Summarize their findings, and provide insights on similarities and differences to assist in the research process.

**How it works:**

1. Uses `search_relevant_papers` (and optionally `online_search_papers`) to retrieve candidate works.
2. Summarizes key ideas, methods, and results from retrieved papers.
3. Performs **chain-of-thought style analysis** to:
   - highlight similarities/differences vs your draft,
   - surface missing baselines or evaluation settings,
   - suggest how to position your contribution.

**Typical usage:**

- “deep_research to compare my draft to recent work on retrieval-augmented generation.”  
- “For this topic, deep_research 5-10 relevant papers and explain where the open gaps are.”

---

## 3. `online_search_papers`

**Purpose:**  
Expand beyond the local DB to search **online academic corpora** (OpenReview + arXiv). This tool is ideal for discovering recent or broader papers beyond those available in the local database.  

**How it works:**

- Called when local search is **too sparse** (new topic) or you explicitly want the **latest** work.
- Queries both **OpenReview** and **arXiv** for up-to-date results.
- Results can then be fed into `deep_research` for synthesis.

**Typical usage:**

- “My topic is very new. Look online for the latest preprints from OpenReview/arXiv.”  

---

## 4. `review_paper`

**Purpose:**  
Analyze and review a draft against the standards of **top-tier ML conferences** (ICLR, ICML, NeurIPS). Identifies improvements and issues in structure, completeness, clarity, and argumentation, then provides prioritized, actionable suggestions.

**How it works:**

- **Pass A – Deterministic checks (fast, high-precision)**  
  - Required sections present (e.g., Abstract, Method, Experiments, Limitations/Broader Impact).  
  - Abstract contains problem, approach, core results, significance.  
  - Acronyms defined at first use; “TODO”, “FIXME”, “Figure ??” flags.  
  - Figures/tables referenced; equation references consistent; citation style uniform.  
  - Reproducibility signals: code/data availability, hyperparameters, seeds, compute, eval protocol.

- **Pass B – Section-aware LLM critiques**  
  - Run per section with **venue-aware rubrics** (NeurIPS/ICML/ICLR style).  
  - Suggest *minimal, targeted edits* (what to add/remove/clarify).  
  - Focus on clarity, completeness, and logical flow.

- **Pass C – Cross-checks (claims vs evidence)**  
  - Are “state-of-the-art” claims backed by numbers + baselines?  
  - Are method components properly ablated?  
  - Are there red flags for data leakage, HPO on test sets, or missing uncertainty reporting?

- **Prioritization**  
  - Each issue is scored by severity (blocker/major/minor), impact, and confidence.  
  - Duplicates are merged and **top-N issues** are surfaced as “quick fixes” vs “substantial rewrites”.

**Typical usage:**

- “review_paper this draft like a NeurIPS reviewer and give me the top 10 issues to fix.”  
- “review_paper on method clarity and experimental rigor.”

---

## 5. `enhance_academic_writing`

**Purpose:**  
Suggest **context-aware academic writing enhancements** for selected text.

**How it works:**

- Powered by **XtraGPT models** tuned for academic style and LaTeX-heavy text.
- Uses surrounding context (section, paper intent, venue) to:
  - improve clarity and flow,
  - reduce redundancy and filler,
  - keep technical content intact,
  - align tone with ML/AI papers.

**Typical usage:**

- "enhance_academic_writing this paragraph to be clearer and more concise, preserving all technical details.”  
- "enhance_academic_writing the abstract to be suitable for NeurIPS.”

## 6. `get_user_papers`

**Purpose:**  
Retrieve **all papers authored by a given user** (OpenReview), identified by email.  
Useful for quickly assembling a researcher’s publication list or grounding context for comparison/positioning.

**How it works:**
- Queries the paper database for matching author email(s).
- Returns structured metadata: title, authors, venue, year, abstract, and identifiers.
- Often used as a preprocessing step before `deep_research`.

**Typical usage:**
- “get_user_papers for <author-email> in summary mode.”  
- “Retrieve all publications by this researcher and then compare my draft using deep_research.”

## 7. Conference Formatter (WIP)

Upcoming workflows will:

- map your draft onto specific **conference templates** (NeurIPS, ICLR, AAAI, etc.),
- adjust sectioning, citation style, and boilerplate requirements,
- highlight formatting and policy mismatches (e.g., ethics, broader impact sections).

---

## Putting It Together: Example Orchestrated Flows

- **Researcher Flow**  
  1. Use `search_relevant_papers` on your draft or topic.  
  2. If results are thin or stale, fall back to `online_search_papers`.  
  3. Call `deep_research` to synthesize and position your work.

- **Reviewer Flow**  
  1. Run `review_paper` on the full draft.  
  2. For high-impact issues, call `enhance_academic_writing` on the relevant spans.  

- **Enhancer Flow**  
  1. Select a paragraph or section in Overleaf.  
  2. Call `enhance_academic_writing` with your preferences (e.g., “more formal”, “shorter”). 
  3. Use edit-diff tool to effect changes. 
