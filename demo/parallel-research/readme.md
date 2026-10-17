# Research related work with Parallel Search MCP

Use [Parallel Search MCP][parallel] in VS Code to find papers and fetch public
source pages, then bring verified source notes into PaperDebugger to review your
draft's related-work coverage. Parallel provides free anonymous search and page
fetching with no account or API key; anonymous search uses Fast mode and has
rate limits.

This is a companion workflow with a manual handoff to PaperDebugger. Its
[XtraMCP research tools](../xtramcp/readme.md) use a separate orchestration
backend. The Parallel endpoint is not a replacement for `XTRAMCP_URI`.

## 1. Connect your research client

You need VS Code with MCP-enabled chat access, plus PaperDebugger installed in
your browser and an Overleaf project. See the [PaperDebugger quick start][start]
if you have not set up the extension yet.

1. In VS Code's Command Palette, run **MCP: Open User Configuration**. This opens
   the `mcp.json` for your VS Code profile.
2. Add the following entry under `servers`. If you already have servers, merge
   the `parallel-search` entry into that object instead of replacing the file.

   ```json
   {
     "servers": {
       "parallel-search": {
         "type": "http",
         "url": "https://search.parallel.ai/mcp",
         "headers": {
           "User-Agent": "PaperDebugger-research-guide/1.0"
         }
       }
     }
   }
   ```

3. Run **MCP: List Servers**, select `parallel-search`, and start it. Confirm
   the trust prompt after reviewing the configuration.
4. Open chat and use **Configure Tools** to enable this server's `web_search`
   and `web_fetch` tools. Confirm they appear before starting your research.

VS Code manages the MCP connection; no PaperDebugger backend changes are
required. For supported configuration locations and troubleshooting, see
[VS Code's MCP guide][vscode]. You can stop the server with **MCP: List Servers**
or remove only its entry from your user configuration when finished.

## 2. Find and check candidate sources

Start with a topic rather than your full draft. For example, ask your research
client:

```text
Use Parallel's web_search to find up to five papers about multi-agent
systems for in-editor academic writing, review, and editing. Prefer
arXiv, OpenReview, and publisher pages. Return titles, authors, dates,
and source URLs. Distinguish preprints from published papers and flag
any metadata you could not verify.
```

Then ask it to fetch the candidate pages:

```text
Use web_fetch on the candidate source URLs. For each accessible page,
record its title, authors, publication or revision date, and a brief
finding relevant to my topic. Include the passage supporting that
finding and its URL. Mark unavailable details as unknown.
```

For a concrete starting point, fetch the [PaperDebugger preprint][paper] at
`https://arxiv.org/abs/2512.02589`. Check the returned title and authors against
the page. An abstract page supports claims about the abstract; read the paper
itself before recording detailed claims about methods or experiments.

Open the original sources and check the metadata and supporting passages. Search
results and extracted excerpts are leads, not proof that a citation or claim is
correct. If a page is inaccessible or a tool returns a rate-limit error, keep it
marked as unverified; retry later or read the source directly.

Keep a short note for each source you have checked:

```text
Source ID: S1
Title:
Authors:
Publication status and date:
Canonical URL or DOI (only if verified):
Date accessed:
Relevant finding:
Supporting passage and section/page:
Limitations or details still unverified:
```

## 3. Review your draft in PaperDebugger

Open your Overleaf project and PaperDebugger. Paste the verified source notes
into chat and ask for a focused comparison with your related-work section:

```text
Compare my related-work section with the verified source notes below.
Identify missing comparisons and claims that need stronger support.
Refer to the source IDs for each suggestion, separate evidence from
your interpretation, and flag anything the notes cannot establish.
Do not invent references, DOIs, or experimental results.

[Paste source notes here.]
```

Review the suggestions against the papers before changing your draft. Add
bibliography entries from publisher, arXiv, or OpenReview metadata you have
checked, then cite their actual keys in Overleaf. The source notes reach
PaperDebugger through the text you paste; the extension does not automatically
import the research client's MCP results.

[parallel]: https://docs.parallel.ai/integrations/mcp/search-mcp
[vscode]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers
[start]: ../../README.md#for-users
[paper]: https://arxiv.org/abs/2512.02589
