# ARCHITECTURE.md

How ai-memory is structured, where reads + writes flow, and where the mock-vs-real swap happens.

For the why, start with [README.md](README.md).

---

## 1. Clean architecture layering

```mermaid
flowchart TB
    subgraph Presentation
        HTTP[HTTP server]
        MCP[MCP server<br/>4 tools]
        CLI[CLI dispatcher]
    end
    subgraph DI
        Container[di/container.js<br/>mock-default + MEMORY_USE_REAL swap]
    end
    subgraph Domain
        UseCases[6 use cases<br/>store / recall / search /<br/>manage_strategies / manage_cognitive /<br/>backup_to_remote]
        Interfaces[6 interfaces<br/>i_vector_store, i_embedding_provider,<br/>i_strategy_store, i_cognitive_store,<br/>i_knowledge_store, i_remote_state_store]
        Entities[Entities<br/>MemoryItem, Strategy, CognitiveState,<br/>Capability, DecisionFramework]
        Constants[Constants<br/>env-var fallback]
    end
    subgraph Data
        Real[Real adapters<br/>SQLiteVectorStore, OllamaEmbeddingProvider,<br/>SQLiteStrategyStore, FileCognitiveStore,<br/>TOMLKnowledgeStore, NextCloudStateStore]
        Mocks[Mocks<br/>InMemoryVectorStore, StubEmbeddingProvider,<br/>InMemoryStrategyStore, InMemoryCognitiveStore,<br/>InMemoryKnowledgeStore, StubRemoteStateStore]
    end

    HTTP --> Container
    MCP --> Container
    CLI --> Container
    Container --> UseCases
    UseCases --> Interfaces
    UseCases --> Entities
    UseCases --> Constants
    Container --> Real
    Container --> Mocks
    Real -.implements.-> Interfaces
    Mocks -.implements.-> Interfaces
```

Same dependency rule as the rest of the nervous-system stack: domain has no imports from data or presentation.

---

## 2. Write flow (remember)

```mermaid
sequenceDiagram
    participant Caller as Caller<br/>(HTTP / MCP / CLI)
    participant UC as store_memory use case
    participant Embed as i_embedding_provider
    participant Vec as i_vector_store

    Caller->>UC: storeMemory(content, metadata)
    UC->>Embed: embed(content)
    Embed-->>UC: vector
    UC->>Vec: store({ content, vector, metadata })
    Vec-->>UC: id
    UC-->>Caller: { id }
```

Two collaborators: an embedder turns text into a vector, a vector store persists the pair. The use case never touches I/O directly.

---

## 3. Read flow (search)

```mermaid
sequenceDiagram
    participant Caller
    participant UC as recall_memory use case
    participant Embed as i_embedding_provider
    participant Vec as i_vector_store

    Caller->>UC: search(query, topK=5)
    UC->>Embed: embed(query)
    Embed-->>UC: queryVector
    UC->>Vec: search(queryVector, { topK })
    Vec-->>UC: items[] (sorted by similarity)
    UC-->>Caller: items[]
```

Same collaborators, opposite direction. The embedder + vector store are the only abstractions that have to agree on dimensionality (default 768 to match `nomic-embed-text:v1.5`).

---

## 4. Mock vs real swap

```mermaid
flowchart LR
    Env[MEMORY_USE_REAL env var<br/>"" / "store,embedder" / "all"]
    Container[createContainer]
    Decide{For each integration<br/>in KNOWN_KEYS:<br/>is it in useReal?}
    Real[Real adapter<br/>SQLite, Ollama, NextCloud]
    Mock[Stub<br/>Map-backed, hash-derived]
    Bundle[Container bundle<br/>{vectorStore, embedder,<br/>strategyStore, cognitiveStore,<br/>knowledgeStore, remoteStateStore}]

    Env --> Container
    Container --> Decide
    Decide -- "yes" --> Real
    Decide -- "no (default)" --> Mock
    Real --> Bundle
    Mock --> Bundle
```

Six swap keys: `store`, `embedder`, `strategies`, `cognitive`, `knowledge`, `remote`.

The stub embedder is deterministic — same input produces the same vector — so cosine search still ranks correctly. You don't get *semantic* similarity (the synthetic vectors aren't trained), but you get reproducible behavior, which is what tests need.

---

## 5. PROTOCOL-12 cognitive continuity

```mermaid
flowchart LR
    Session1[Session 1<br/>agent does work]
    Reflect[reflection.json<br/>"this is what I learned"]
    Attend[attention.json<br/>"this is what to focus on next"]
    Calibrate[calibration.json<br/>"this is how confident I am"]
    Session2[Session 2<br/>boot reads them]

    Session1 --> Reflect
    Session1 --> Attend
    Session1 --> Calibrate
    Reflect -.persists across crash/restart.-> Session2
    Attend -.-> Session2
    Calibrate -.-> Session2
```

These three files are how raj-sadan's agent maintains continuity across sessions. The agent writes them before exit; the boot sequence reads them and uses them to construct the new session's prompt.

`InMemoryCognitiveStore` keeps these in process — useful for tests but loses state on restart. `FileCognitiveStore` persists to JSON files on disk — that's what raj-sadan uses in production.

The contract is in CONTRACTS.md (when written) — same file format any consumer can read.

---

## 6. MCP tool surface

```mermaid
flowchart TB
    Claude[Claude Code]
    Cursor[Cursor]
    Codex[Codex]

    subgraph MCP[MCP server / stdio]
        Remember[memory_remember<br/>store content + vector]
        Recall[memory_recall<br/>fetch by id]
        Search[memory_search<br/>top-k similarity]
        State[memory_state<br/>cognitive snapshot]
    end

    Claude --stdio--> MCP
    Cursor --stdio--> MCP
    Codex --stdio--> MCP

    Remember --> Container[(DI container)]
    Recall --> Container
    Search --> Container
    State --> Container
```

Four tools. Each one is a thin wrapper around a container method. Add a tool: register it in `src/presentation/mcp/server.js` and document it in the README.

---

## What's deliberately not here

- **Embedding model fine-tuning.** ai-memory holds vectors; it doesn't train the embedder. Real consumers wire whichever Ollama-served model they prefer (via `MEMORY_EMBEDDING_MODEL`).
- **Forgetting algorithms beyond decay.** Strategy weights decay over time and respond to reinforce/weaken signals. There's no "active forgetting" use case in v0.1.0 — when a memory item is no longer relevant, the calling agent decides whether to delete it.
- **Cross-organ orchestration.** ai-memory persists state and answers queries. It doesn't decide what's worth remembering — that's the cognitive layer's job (ai-mind).

---

## See also

- [README.md](README.md)
- [CHANGELOG.md](CHANGELOG.md)
- [`src/di/container.js`](src/di/container.js) — the swap mechanism
- [`src/presentation/mcp/server.js`](src/presentation/mcp/server.js) — the four tools
