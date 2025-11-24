# XtraMCP Server - Orchestration Prompts

This directory contains MCP prompts that orchestrate complex workflows by guiding the AI on how to use multiple tools together effectively.

## Available Prompts

### 1. `analyze_paper_find_similar`
**Purpose**: Analyze existing research papers (PDF/LaTeX) and find similar work in the academic literature.

**Use Cases**:
- Finding papers similar to your own research
- Identifying related work for a paper you're writing
- Comparing your approach with existing methods in the literature
- Building a collection of papers related to a specific source paper

**Arguments**:
- `paper_path` (required): Path to PDF or LaTeX file to analyze
- `analysis_focus` (optional): Focus area - 'methodology', 'application domain', 'theoretical contributions', or 'all' (default: 'all')
- `comparison_type` (optional): Type of comparison - 'similar_methods', 'related_problems', 'same_domain', 'theoretical_connections' (default: 'related_problems')
- `venues` (optional): Conference venues to search (default: ICLR.cc, NeurIPS.cc, ICML.cc)
- `years` (optional): Years to search (default: last 3 years)
- `max_papers` (optional): Maximum papers to find (default: 12)

**Example Usage**:
```
paper_path: "./papers/my_research_paper.pdf"
analysis_focus: "methodology"
comparison_type: "similar_methods"
max_papers: 15
```

### 2. `literature_review`
**Purpose**: Conduct comprehensive and systematic literature reviews with topic-based discovery.

**Use Cases**:
- Systematic literature reviews for research proposals
- Comprehensive coverage of a research area
- Finding papers on a specific topic or research question
- Multi-faceted topic exploration with related areas
- Building reference collections for academic writing

**Arguments**:
- `main_topic` (required): Main research topic, research question, or paper description to investigate
- `source_context` (optional): Context from existing work, abstracts, or specific research focus to guide keyword extraction
- `related_topics` (optional): Comma-separated list of related topics, subtopics, or alternative terms to explore
- `research_scope` (optional): 'focused' (10 papers, specific), 'standard' (15 papers, balanced), 'comprehensive' (25 papers, broad coverage) (default: 'standard')
- `venues` (optional): Conference venues to search (default: ICLR.cc, NeurIPS.cc, ICML.cc)
- `time_range` (optional): 'recent' (2 years), 'standard' (3 years), 'comprehensive' (5 years) (default: 'standard')

**Example Usage**:
```
main_topic: "multimodal machine learning for medical imaging"
related_topics: "vision-language models, medical AI, cross-modal attention"
research_scope: "comprehensive"
time_range: "comprehensive"
```

## Key Differences

| Aspect | `analyze_paper_find_similar` | `literature_review` |
|--------|------------------------------|---------------------|
| **Input** | Existing paper file (PDF/LaTeX) | Research topic/question |
| **Approach** | Paper content analysis → keyword extraction | Topic analysis → keyword strategy |
| **Focus** | Finding work similar to specific paper | Comprehensive topic coverage |
| **Output** | Papers similar to source paper | Systematic literature collection |
| **Tools Used** | `search_papers_on_openreview` → `export_papers` | `search_papers_on_openreview` → `export_papers` |
| **Export Dir** | `./papers/openreview_exports/similar_papers/` | `./papers/openreview_exports/literature_review/` |
| **Search Strategy** | High precision (min_score 0.8) | Balanced coverage (min_score 0.75) |
| **Loop Prevention** | Allowed to run more than once but avoid loops, proceed with results | Allowed to run more than once but avoid loops, proceed with results |

## Workflow Overview

Both prompts follow a structured approach:

### `analyze_paper_find_similar` Workflow:
1. **Source Paper Analysis**: Extract content from PDF/LaTeX file
2. **Keyword Extraction**: Identify key concepts based on analysis focus
3. **Strategic Search**: Use `search_papers_on_openreview` tool with extracted keywords
4. **Export Collection**: Use `export_papers` tool for organized download
5. **Similarity Report**: Analyze how found papers relate to source

### `literature_review` Workflow:
1. **Topic Analysis**: Extract effective search terms from research topic
2. **Keyword Strategy**: Develop comprehensive search approach
3. **Systematic Search**: Use `search_papers_on_openreview` tool with strategic keywords
4. **Export Organization**: Use `export_papers` tool with systematic naming
5. **Research Synthesis**: Provide structured literature analysis

## Default Configuration

The prompts use these optimized defaults:

| Parameter | `analyze_paper_find_similar` | `literature_review` |
|-----------|------------------------------|---------------------|
| **Venues** | ICLR.cc, NeurIPS.cc, ICML.cc | ICLR.cc, NeurIPS.cc, ICML.cc |
| **Search Fields** | title, abstract | title, abstract |
| **Match Mode** | threshold | threshold |
| **Match Threshold** | 0.6 | 0.5 |
| **Min Score** | 0.8 (high precision) | 0.75 (balanced) |
| **Max Papers** | 12 | 10-25 (scope dependent) |
| **Years** | Last 3 years | 2-5 years (time_range dependent) |
| **Search Strategy** | Allowed to run more than once but avoid loops | ONE Allowed to run more than once but avoid loops |

## Output Structure

Each workflow creates:

- **JSON Files**: Structured metadata about found papers
- **PDF Downloads**: Full paper downloads for offline reading  
- **Organized Exports**: Papers saved to specific subdirectories
- **Analysis Reports**: Key findings and research insights

### File Organization:
```
papers/openreview_exports/
├── similar_papers/           # analyze_paper_find_similar outputs
│   └── [source_paper]_similar_[comparison_type].json
└── literature_review/        # literature_review outputs
    └── [topic]_review_[scope].json
```

## Integration with Tools

These prompts orchestrate the following MCP tools in a two-step workflow:

1. **`search_papers_on_openreview`**: Find relevant papers based on keywords and venues, returning paper IDs
2. **`export_papers`**: Download PDFs and create organized JSON collections using the paper IDs from search results

The prompts provide precise instructions on:
- Sequential tool execution (search first, then export)
- Paper ID extraction from search results
- Tool parameter configuration
- Error handling and validation
- Output organization and naming

## Tips for Effective Use

### For `analyze_paper_find_similar`:
1. **File Access**: Ensure the paper path is accessible and readable
2. **Analysis Focus**: Choose specific focus for more targeted results
3. **Comparison Type**: Select based on what aspect of similarity you want
4. **File Formats**: Works with both PDF and LaTeX source files

### For `literature_review`:
1. **Topic Clarity**: Use precise, technical terminology in your main topic
2. **Scope Selection**: Match scope to your research needs (focused/standard/comprehensive)
3. **Related Topics**: Include synonyms and alternative terms for broader coverage
4. **Context Utilization**: Provide source context to guide keyword extraction

### General Best Practices:
1. **Venue Selection**: Add domain-specific venues for specialized topics
2. **Time Range**: Adjust based on field evolution and research currency
3. **Quality Thresholds**: Higher min_score for more precise results
4. **Export Organization**: Use descriptive names for easy file management
