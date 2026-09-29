"""ACE — Skills, Languages & Roadmaps.

Large curated taxonomy of programming languages and skill tracks with staged
learning plans, plus per-company preparation roadmaps generated from the real
placement database (difficulty, rounds, key skills, CTC band).
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/roadmaps")

# ----------------------------------------------------------------- languages
LANGUAGES: list[dict[str, Any]] = [
    {"slug": "python", "name": "Python", "icon": "🐍", "family": "General Purpose", "demand_index": 98,
     "blurb": "The #1 language for AI/ML, data analytics, automation and backend services. Readable syntax, massive library ecosystem.",
     "use_cases": ["AI / ML pipelines", "Data analytics (pandas)", "FastAPI backends", "Automation & scripting"],
     "avg_ctc_band": "₹6 - ₹45 LPA", "roles": ["Data Scientist", "Backend Engineer", "ML Engineer", "Automation Engineer"],
     "core_skills": ["Core syntax & data structures", "OOP & decorators", "pandas / NumPy", "FastAPI / Flask", "asyncio"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 3, "topics": ["Syntax, lists, dicts, sets", "Control flow & comprehensions", "Functions, *args/**kwargs", "File & error handling"], "project": "CLI expense tracker with JSON persistence", "checkpoint": "Solve 30 easy problems unaided"},
         {"stage": "Intermediate", "weeks": 4, "topics": ["OOP: classes, dataclasses, dunder methods", "Decorators & generators", "virtualenv, pip, packaging", "unittest / pytest"], "project": "Library management REST API with FastAPI", "checkpoint": "Build & test a CRUD API solo"},
         {"stage": "Advanced", "weeks": 4, "topics": ["asyncio & concurrent futures", "pandas / NumPy pipelines", "Type hints & mypy", "Profiling & optimization"], "project": "Sales analytics pipeline (CSV → insights dashboard)", "checkpoint": "Async data pipeline < 100ms/query"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Top 50 Python interview questions", "GIL, memory model", "Live-coding patterns", "System questions with Python"], "project": "Timed mock interview set", "checkpoint": "Pass 2 mock interviews at 70%+"},
     ]},
    {"slug": "java", "name": "Java", "icon": "☕", "family": "Enterprise / Service-Based Favorite", "demand_index": 95,
     "blurb": "The service-company staple (TCS, Infosys, Accenture) and product-company backend workhorse. OOP, JVM ecosystem, Spring Boot.",
     "use_cases": ["Enterprise backends (Spring Boot)", "Android development", "Big data (Hadoop/Spark)", "Service-company hiring tests"],
     "avg_ctc_band": "₹4.5 - ₹40 LPA", "roles": ["Java Developer", "Backend Engineer", "Android Developer", "Big Data Engineer"],
     "core_skills": ["OOP mastery", "Collections & Generics", "Streams & lambdas", "Spring Boot", "JDBC / Hibernate"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 3, "topics": ["Syntax, primitives, arrays", "OOP: inheritance, polymorphism, interfaces", "Exceptions & packages", "String & StringBuilder"], "project": "Bank account console app", "checkpoint": "Explain all 4 OOP pillars with code"},
         {"stage": "Intermediate", "weeks": 4, "topics": ["Collections framework deep-dive", "Generics & bounded types", "Streams, lambdas, Optional", "File I/O & serialization"], "project": "Student records manager with Streams analytics", "checkpoint": "Use the right collection for 10 scenarios"},
         {"stage": "Advanced", "weeks": 5, "topics": ["Spring Boot: DI, REST, validation", "JPA / Hibernate", "JUnit 5 + Mockito", "Maven / Gradle builds"], "project": "Placement portal backend (Spring Boot + PostgreSQL)", "checkpoint": "Deploy a Spring Boot service with tests"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Top 60 Java interview questions", "HashMap internals", "equals/hashCode contracts", "Concurrency basics"], "project": "Timed mock interview set", "checkpoint": "Pass service-company pattern tests"},
     ]},
    {"slug": "javascript", "name": "JavaScript", "icon": "🟨", "family": "Web Standard", "demand_index": 94,
     "blurb": "The language of the web — frontends everywhere plus Node.js backends. Required for full-stack roles.",
     "use_cases": ["React / frontend apps", "Node.js APIs", "Browser automation", "Full-stack products"],
     "avg_ctc_band": "₹5 - ₹38 LPA", "roles": ["Frontend Engineer", "Full-Stack Developer", "Node.js Developer"],
     "core_skills": ["DOM & events", "ES6+ features", "Async: promises, async/await", "Fetch & REST", "One framework (React)"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Variables, types, operators", "DOM selection & events", "Functions & closures", "Arrays & objects"], "project": "Interactive quiz webpage", "checkpoint": "Build a tabbed UI from scratch"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["ES6: destructuring, spread, modules", "Promises & async/await", "fetch + error handling", "localStorage & JSON"], "project": "Weather app consuming a public API", "checkpoint": "Handle async flows without callback chaos"},
         {"stage": "Advanced", "weeks": 4, "topics": ["React: components, hooks, state", "React Router & forms", "Node.js + Express basics", "ES modules & bundlers"], "project": "Job tracker SPA (React + Express + SQLite)", "checkpoint": "Ship a deployed full-stack mini app"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Event loop & microtasks", "this/call/apply/bind", "Closures & hoisting traps", "Debounce/throttle implementations"], "project": "Implement 10 utility functions from scratch", "checkpoint": "Explain event loop with examples"},
     ]},
    {"slug": "typescript", "name": "TypeScript", "icon": "🔷", "family": "Typed Web", "demand_index": 90,
     "blurb": "JavaScript with a type system — the default at product companies and required by this platform's own frontend stack.",
     "use_cases": ["Large React apps", "Angular / enterprise UIs", "Typed Node.js APIs", "Design systems"],
     "avg_ctc_band": "₹8 - ₹45 LPA", "roles": ["Frontend Engineer", "Full-Stack Developer", "UI Platform Engineer"],
     "core_skills": ["Types & interfaces", "Generics", "Union / narrowing", "Utility types", "tsconfig literacy"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Basic types & inference", "Interfaces vs type aliases", "Functions & optional params", "Enum & literal types"], "project": "Convert a JS todo app to strict TS", "checkpoint": "Zero `any` in a strict-mode build"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Unions & discriminated unions", "Narrowing & type guards", "Generics with constraints", "Utility types (Partial, Pick…)"], "project": "Typed API client library with generics", "checkpoint": "Model a complex domain without errors"},
         {"stage": "Advanced", "weeks": 3, "topics": ["Mapped & conditional types", "Declaration files", "React + TS patterns", "Zod / runtime validation"], "project": "Typed React dashboard consuming REST", "checkpoint": "End-to-end typed data flow"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["Type-level puzzles", "any vs unknown vs never", "Structural typing questions", "Refactoring exercises"], "project": "Solve 20 type challenges", "checkpoint": "Pass TS live-coding round"},
     ]},
    {"slug": "c", "name": "C", "icon": "🔧", "family": "Systems", "demand_index": 72,
     "blurb": "Foundation of all computing — memory, pointers, embedded systems and core-engineering roles.",
     "use_cases": ["Embedded & IoT", "OS / systems programming", "Competitive programming base", "Core engineering roles"],
     "avg_ctc_band": "₹4 - ₹18 LPA", "roles": ["Embedded Engineer", "Systems Programmer", "Firmware Developer"],
     "core_skills": ["Pointers & memory", "Arrays & strings", "Structs", "File I/O", "Bit manipulation"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 3, "topics": ["Types, operators, control flow", "Functions & recursion", "Arrays & strings", "Pointers basics"], "project": "Matrix operations library", "checkpoint": "Trace pointer arithmetic on paper"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Dynamic memory (malloc/free)", "Structs & unions", "File handling", "Preprocessor & multi-file builds"], "project": "Student database with linked lists", "checkpoint": "Zero leaks in valgrind run"},
         {"stage": "Advanced", "weeks": 3, "topics": ["Bit manipulation", "Function pointers", "Memory layout & alignment", "Make & toolchains"], "project": "Mini shell in C", "checkpoint": "Implement 5 classic bit tricks"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Top pointer puzzles", "String manipulation drills", "Static vs dynamic vs stack", "Embedded C questions"], "project": "50-problem practice set", "checkpoint": "Solve pointer puzzles in < 10 min"},
     ]},
    {"slug": "cpp", "name": "C++", "icon": "⚡", "family": "Competitive / Systems", "demand_index": 86,
     "blurb": "The competitive-programming and high-performance staple — STL, OOP and speed. Core for Tier-1 product interviews.",
     "use_cases": ["Competitive programming", "Game engines", "HFT / low-latency systems", "Tier-1 product interviews"],
     "avg_ctc_band": "₹7 - ₹55 LPA", "roles": ["SDE at Product Companies", "Game Developer", "Quant Developer"],
     "core_skills": ["STL mastery", "OOP & templates", "Memory management", "Algorithms & complexity", "Concurrency basics"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 3, "topics": ["Syntax, references, I/O streams", "Classes & OOP", "Constructors / RAII", "Namespaces"], "project": "Bank simulation with classes", "checkpoint": "Explain RAII and rule of three"},
         {"stage": "Intermediate", "weeks": 4, "topics": ["STL: vector, map, set, priority_queue", "Iterators & algorithms", "Templates & generics", "Smart pointers"], "project": "Task scheduler using STL containers", "checkpoint": "Pick optimal STL container in 20 scenarios"},
         {"stage": "Advanced", "weeks": 4, "topics": ["DP & graph patterns", "Move semantics", "Multithreading", "Competitive templates"], "project": "Solve 100 DSA problems (Striver sheet)", "checkpoint": "Median solve < 25 min on Leetcode medium"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Company-tagged problems (Google/Amazon)", "LLD: design patterns in C++", "Memory & perf questions", "Mock OA sets"], "project": "2 full mock OAs at 80%+", "checkpoint": "Clear a 90-min OA mock"},
     ]},
    {"slug": "sql", "name": "SQL", "icon": "🗄️", "family": "Data", "demand_index": 96,
     "blurb": "Every data role and nearly every interview requires it. Joins, window functions, normalization and query tuning.",
     "use_cases": ["Analytics & BI", "Backend data layers", "Data engineering", "Every service-company test"],
     "avg_ctc_band": "₹5 - ₹35 LPA", "roles": ["Data Analyst", "Backend Engineer", "Data Engineer", "DBA"],
     "core_skills": ["SELECT / JOINs", "GROUP BY & HAVING", "Window functions", "Indexes & query plans", "Normalization"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["SELECT, WHERE, ORDER BY", "INSERT/UPDATE/DELETE", "Aggregate functions", "Basic JOINs"], "project": "Query a sample e-commerce DB (50 queries)", "checkpoint": "Write 20 queries from plain-English asks"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["INNER/LEFT/SELF joins mastery", "GROUP BY + HAVING", "Subqueries & CTEs", "CASE & conditional logic"], "project": "Sales analytics report pack", "checkpoint": "Solve top-25 SQL interview questions"},
         {"stage": "Advanced", "weeks": 3, "topics": ["Window functions (RANK, LAG, OVER)", "Indexes & EXPLAIN plans", "Transactions & ACID", "Normalization to 3NF"], "project": "Tune 5 slow queries with index evidence", "checkpoint": "Cut a query's cost 10× with proof"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["Leetcode SQL 50", "Company-specific query sets", "Design a schema live", "Tricky puzzles (gaps & islands)"], "project": "Full mock SQL round", "checkpoint": "Pass a 45-min SQL interview"},
     ]},
    {"slug": "go", "name": "Go (Golang)", "icon": "🐹", "family": "Cloud / Backend", "demand_index": 84,
     "blurb": "Cloud-native backend language — Docker and Kubernetes are written in it. Simple, fast, great concurrency.",
     "use_cases": ["Microservices", "Cloud & DevOps tooling", "High-concurrency backends", "CLI tools"],
     "avg_ctc_band": "₹10 - ₹45 LPA", "roles": ["Backend Engineer", "Platform / DevOps Engineer", "SRE"],
     "core_skills": ["Goroutines & channels", "net/http & JSON", "Interfaces", "Modules", "Testing"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Syntax, structs, slices, maps", "Errors as values", "Packages & modules", "Defer & panic/recover"], "project": "CLI todo tool", "checkpoint": "Idiomatic error handling throughout"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Goroutines & WaitGroups", "Channels & select", "net/http servers", "encoding/json & SQL (database/sql)"], "project": "URL shortener API with Postgres", "checkpoint": "Concurrent worker pool without races"},
         {"stage": "Advanced", "weeks": 3, "topics": ["Context & cancellation", "Interface design patterns", "table-driven tests & benchmarks", "Dockerizing Go services"], "project": "Rate-limited API gateway service", "checkpoint": "Benchmarked service < 10ms p99 locally"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Concurrency puzzles", "GC & memory model questions", "System design with Go", "Common pkg interview drills"], "project": "Design a chat service doc + skeleton", "checkpoint": "Whiteboard a concurrent system design"},
     ]},
    {"slug": "rust", "name": "Rust", "icon": "🦀", "family": "Systems", "demand_index": 76,
     "blurb": "Memory safety without garbage collection — the most loved language a decade running, rising in systems & blockchain roles.",
     "use_cases": ["Systems programming", "WebAssembly", "Blockchain", "Performance-critical services"],
     "avg_ctc_band": "₹12 - ₹50 LPA", "roles": ["Systems Engineer", "Blockchain Developer", "Performance Engineer"],
     "core_skills": ["Ownership & borrowing", "Lifetimes", "Result/Option", "Traits", "Cargo"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 3, "topics": ["Ownership & moves", "Borrowing & references", "Structs & enums", "Cargo & crates"], "project": "Word-frequency CLI", "checkpoint": "Fight the borrow checker successfully 20×"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Lifetimes", "Error handling with Result", "Traits & generics", "Collections & iterators"], "project": "Key-value store with file persistence", "checkpoint": "Idiomatic error propagation everywhere"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Smart pointers (Box, Rc, Arc)", "Concurrency (threads, channels)", "async Rust basics", "Testing & benchmarking"], "project": "Multi-threaded web scraper", "checkpoint": "Concurrent app without data races"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Rust interview classics", "Memory model questions", "Design exercises", "Crate ecosystem tour"], "project": "Implement a mini Redis", "checkpoint": "Explain ownership to an interviewer cleanly"},
     ]},
    {"slug": "kotlin", "name": "Kotlin", "icon": "🟣", "family": "Mobile / JVM", "demand_index": 78,
     "blurb": "Official Android language and a concise JVM alternative for backend work.",
     "use_cases": ["Android apps", "Multiplatform mobile", "JVM backends (Ktor/Spring)", "Scripting"],
     "avg_ctc_band": "₹6 - ₹30 LPA", "roles": ["Android Developer", "Mobile Engineer", "JVM Backend Developer"],
     "core_skills": ["Null safety", "Data classes & sealed classes", "Coroutines", "Compose basics", "Java interop"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["val/var, type system", "Null safety (&?., ?:)", "Functions & lambdas", "Data classes"], "project": "Notes console app", "checkpoint": "No NullPointerException-prone code"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Sealed classes & when", "Extensions & delegation", "Collections API", "Coroutines basics"], "project": "Expense-splitter logic library", "checkpoint": "Coroutine flows without leaks"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Jetpack Compose UI", "ViewModel & state", "Room database", "Retrofit networking"], "project": "Full Android job-tracker app", "checkpoint": "Publish a working APK"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Android lifecycle questions", "Kotlin idioms quiz", "Compose vs XML questions", "App architecture (MVVM)"], "project": "Architecture refactor of your app", "checkpoint": "Explain MVVM with your own code"},
     ]},
    {"slug": "swift", "name": "Swift", "icon": "🍎", "family": "Apple Ecosystem", "demand_index": 68,
     "blurb": "iOS/macOS development standard — optionals, protocols, SwiftUI.",
     "use_cases": ["iOS apps", "macOS utilities", "visionOS / Apple ecosystem"],
     "avg_ctc_band": "₹8 - ₹35 LPA", "roles": ["iOS Developer", "Mobile Engineer"],
     "core_skills": ["Optionals", "Protocols & extensions", "SwiftUI", "Combine/async", "App lifecycle"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Swift syntax & optionals", "Structs vs classes", "Closures", "Protocol basics"], "project": "Unit converter app", "checkpoint": "Force-unwrap-free code"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Protocols & generics", "Error handling", "UIKit basics", "Networking with URLSession"], "project": "GitHub repo browser", "checkpoint": "Async network layer with error states"},
         {"stage": "Advanced", "weeks": 4, "topics": ["SwiftUI declarative UI", "State management", "Core Data", "Concurrency (async/await)"], "project": "Habit tracker with persistence", "checkpoint": "AppStore-review-ready build"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["iOS interview classics", "Memory & ARC questions", "SwiftUI vs UIKit", "System design an app"], "project": "Design a chat app architecture doc", "checkpoint": "Whiteboard an app design"},
     ]},
    {"slug": "php", "name": "PHP", "icon": "🐘", "family": "Web Backend", "demand_index": 65,
     "blurb": "Powers most of the web's CMSs (WordPress) and still huge in agency/freelance markets. Laravel is the modern framework.",
     "use_cases": ["WordPress ecosystem", "Laravel SaaS backends", "Agency web development"],
     "avg_ctc_band": "₹4 - ₹20 LPA", "roles": ["Web Developer", "Laravel Developer", "CMS Developer"],
     "core_skills": ["Forms & sessions", "PDO & MySQL", "OOP PHP", "Laravel MVC", "Composer"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Syntax, arrays, forms", "Sessions & cookies", "Functions & includes", "MySQL with PDO"], "project": "Contact form with DB storage", "checkpoint": "CRUD without SQL injection"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["OOP PHP", "Composer & autoloading", "MVC pattern by hand", "REST basics"], "project": "Mini blog engine", "checkpoint": "Routing + templating separated"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Laravel install & routes", "Eloquent ORM", "Blade templates", "Auth & middleware"], "project": "Job board in Laravel", "checkpoint": "Deployed Laravel app with auth"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["PHP quirks interview set", "Laravel lifecycle", "Security questions", "Performance basics"], "project": "Code review exercise", "checkpoint": "Answer top-30 PHP questions"},
     ]},
    {"slug": "ruby", "name": "Ruby", "icon": "💎", "family": "Web Backend", "demand_index": 58,
     "blurb": "Developer-happiness language behind Rails — startup favorite for rapid product building.",
     "use_cases": ["Rails startups", "Rapid MVPs", "DevOps tooling (Chef/Vagrant)"],
     "avg_ctc_band": "₹6 - ₹28 LPA", "roles": ["Rails Developer", "Full-Stack Developer", "DevOps Engineer"],
     "core_skills": ["Ruby OOP", "Blocks & mixins", "Rails MVC", "ActiveRecord", "Testing (RSpec)"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Ruby syntax & collections", "Blocks, procs, lambdas", "Modules & mixins", "OOP in Ruby"], "project": "Library CLI tool", "checkpoint": "Idiomatic block usage"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Gems & Bundler", "Metaprogramming basics", "File & JSON handling", "MiniTest"], "project": "Markdown parser gem", "checkpoint": "Publish a tested gem"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Rails: routes, controllers, views", "ActiveRecord & migrations", "Devise auth", "RSpec"], "project": "Event booking platform in Rails", "checkpoint": "Deployed Rails app with tests"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["Rails lifecycle questions", "Ruby object model", "N+1 & performance", "Common gems quiz"], "project": "Optimize a slow Rails endpoint", "checkpoint": "Explain Rails request lifecycle"},
     ]},
    {"slug": "r", "name": "R", "icon": "📊", "family": "Statistics", "demand_index": 60,
     "blurb": "Statistical computing standard — analysts, researchers and data science education.",
     "use_cases": ["Statistical analysis", "Research & academia", "Data visualization (ggplot2)", "Biostatistics"],
     "avg_ctc_band": "₹5 - ₹24 LPA", "roles": ["Data Analyst", "Research Scientist", "Biostatistician"],
     "core_skills": ["Vectors & data.frames", "dplyr & tidyverse", "ggplot2", "Statistical tests", "RMarkdown"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Vectors, lists, data.frames", "Indexing & subsetting", "Functions", "Basic plots"], "project": "Iris dataset exploration", "checkpoint": "Reshape data without googling"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["dplyr verbs & pipes", "tidyr reshaping", "ggplot2 grammar", "Joins"], "project": "COVID data analysis report", "checkpoint": "Publication-grade ggplot chart"},
         {"stage": "Advanced", "weeks": 3, "topics": ["Statistical tests & inference", "Linear & logistic regression", "Shiny dashboards", "RMarkdown reports"], "project": "Interactive Shiny dashboard", "checkpoint": "Defend a regression model's assumptions"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["Analyst interview questions", "A/B test interpretation", "Case studies", "Package ecosystem"], "project": "Mock analyst case study", "checkpoint": "Present insights from raw data"},
     ]},
    {"slug": "scala", "name": "Scala", "icon": "🔺", "family": "Big Data", "demand_index": 62,
     "blurb": "Functional-meets-OOP JVM language — the native tongue of Apache Spark and big-data engineering.",
     "use_cases": ["Apache Spark pipelines", "Big data engineering", "Functional JVM backends"],
     "avg_ctc_band": "₹9 - ₹40 LPA", "roles": ["Big Data Engineer", "Data Platform Engineer"],
     "core_skills": ["Immutable data & case classes", "Pattern matching", "Collections API", "Spark DataFrame API", "Functional patterns"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["val/var, case classes", "Pattern matching", "Collections & higher-order functions", "SBT basics"], "project": "Log parser CLI", "checkpoint": "Think immutably by default"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Traits & functional composition", "Option/Either/Try", "Implicits (reading them)", "Concurrency (Futures)"], "project": "CSV transformation library", "checkpoint": "Chain transformations functionally"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Spark architecture", "DataFrame transformations", "Window functions in Spark", "Partitioning & performance"], "project": "Spark job over 1GB+ dataset", "checkpoint": "Job tuned to avoid shuffles"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Spark interview classics", "RDD vs DataFrame", "Data skew fixes", "Lambda architecture"], "project": "Design a batch pipeline doc", "checkpoint": "Whiteboard a Spark pipeline"},
     ]},
    {"slug": "dart", "name": "Dart", "icon": "🎯", "family": "Mobile / Cross-Platform", "demand_index": 66,
     "blurb": "Flutter's language — one codebase for iOS, Android, web and desktop. Fast-growing startup stack.",
     "use_cases": ["Flutter apps", "Cross-platform products", "Startup MVPs"],
     "avg_ctc_band": "₹5 - ₹26 LPA", "roles": ["Flutter Developer", "Mobile Engineer"],
     "core_skills": ["Dart syntax & null safety", "Widgets", "State management", "async/await & Futures", "Firebase integration"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Dart syntax & null safety", "Functions & classes", "Collections & generics", "Futures & async"], "project": "Unit converter CLI", "checkpoint": "Read Flutter code comfortably"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["Widgets & layout", "Stateful vs stateless", "Navigation", "Forms & input"], "project": "Multi-screen notes app", "checkpoint": "Build 5 common UI patterns"},
         {"stage": "Advanced", "weeks": 4, "topics": ["Provider / Riverpod state", "REST + json_serializable", "Local storage (Hive)", "Theming"], "project": "Expense tracker with charts", "checkpoint": "Published debug app on a real device"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Widget lifecycle questions", "State management tradeoffs", "Performance & rebuilds", "Store deployment flow"], "project": "Interview prep flashcard app", "checkpoint": "Explain widget tree vs element tree"},
     ]},
    {"slug": "bash", "name": "Bash / Shell", "icon": "🐚", "family": "DevOps", "demand_index": 74,
     "blurb": "The automation glue of every server, CI pipeline and cloud workflow.",
     "use_cases": ["DevOps automation", "CI/CD scripts", "Server administration", "Data pipelines glue"],
     "avg_ctc_band": "₹5 - ₹30 LPA", "roles": ["DevOps Engineer", "SRE", "Cloud Engineer"],
     "core_skills": ["File ops & pipes", "grep/sed/awk", "Scripting logic", "cron & ssh", "Exit codes & robustness"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 1, "topics": ["Navigating & file operations", "Pipes & redirection", "Permissions", "Variables & quoting"], "project": "Backup script with rotation", "checkpoint": "One-liners for 10 admin tasks"},
         {"stage": "Intermediate", "weeks": 2, "topics": ["Conditionals & loops", "grep / sed / awk", "Functions & arguments", "Exit codes & set -e"], "project": "Log analyzer script", "checkpoint": "Robust script with error handling"},
         {"stage": "Advanced", "weeks": 2, "topics": ["cron scheduling", "ssh & scp automation", "Process management", "CI integration (GitHub Actions)"], "project": "Automated deploy script", "checkpoint": "Zero-touch deploy from a commit"},
         {"stage": "Interview Ready", "weeks": 1, "topics": ["Top shell questions", "Debug a broken pipeline", "One-liner challenges", "System health checks"], "project": "Server health-check toolkit", "checkpoint": "Live-debug a broken script"},
     ]},
    {"slug": "csharp", "name": "C#", "icon": "🎮", "family": "Microsoft / Game Dev", "demand_index": 70,
     "blurb": ".NET backends, enterprise software and Unity game development.",
     "use_cases": [".NET enterprise apps", "Unity games", "Windows desktop apps", "Azure services"],
     "avg_ctc_band": "₹5 - ₹30 LPA", "roles": [".NET Developer", "Unity Developer", "Azure Engineer"],
     "core_skills": ["OOP & LINQ", "async/await", "ASP.NET Core", "Entity Framework", "Unity basics (games)"],
     "roadmap": [
         {"stage": "Foundation", "weeks": 2, "topics": ["Types & OOP", "Properties & interfaces", "Collections & generics", "Exceptions"], "project": "Inventory console app", "checkpoint": "Clean class design exercise"},
         {"stage": "Intermediate", "weeks": 3, "topics": ["LINQ", "async/await & Tasks", "Delegates & events", "Unit testing (xUnit)"], "project": "Library management with LINQ reports", "checkpoint": "Async code without deadlocks"},
         {"stage": "Advanced", "weeks": 4, "topics": ["ASP.NET Core Web API", "Entity Framework Core", "Dependency injection", "Auth (JWT)"], "project": "Job portal API in .NET", "checkpoint": "Deployed API with EF migrations"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["C# interview classics", "CLR & GC questions", "LINQ internals", "Design a service live"], "project": "Mock .NET interview set", "checkpoint": "Pass .NET tech round"},
     ]},
]

# ----------------------------------------------------------------- skill tracks
SKILL_TRACKS: list[dict[str, Any]] = [
    {"slug": "dsa", "name": "Data Structures & Algorithms", "icon": "🧩", "demand_index": 97,
     "blurb": "The #1 interview filter at every product company. Patterns beat problems — learn the 15 core patterns.",
     "unlocks": ["Tier-1 Product eligibility", "80% of coding interviews", "Competitive programming"],
     "roadmap": [
         {"stage": "Foundations", "weeks": 4, "topics": ["Complexity analysis (Big-O)", "Arrays & two pointers", "Hashing & prefix sums", "Strings & sliding window", "Stacks & queues"], "project": "Pattern journal: 40 problems tagged by pattern", "checkpoint": "Solve easies in < 15 min median"},
         {"stage": "Core Patterns", "weeks": 5, "topics": ["Linked lists", "Recursion & backtracking", "Binary search & variants", "Trees & traversals", "Heaps & priority queues"], "project": "Visualizer app for one structure", "checkpoint": "100 problems milestone"},
         {"stage": "Advanced", "weeks": 5, "topics": ["Graphs: BFS/DFS/topo sort", "Dynamic programming patterns", "Greedy & intervals", "Tries & union-find"], "project": "Striver/NeetCode sheet completion", "checkpoint": "Mediums < 25 min median"},
         {"stage": "Interview Ready", "weeks": 3, "topics": ["Company-tagged sets", "Weekly contests", "Mock interviews (Pramp/peer)", "Communication & edge cases"], "project": "6 mock interviews recorded & reviewed", "checkpoint": "Pass 2 consecutive mocks at target company difficulty"},
     ]},
    {"slug": "web-fullstack", "name": "Full-Stack Web Development", "icon": "🌐", "demand_index": 95,
     "blurb": "Frontend + backend + database + deploy. The largest job pool for freshers in India.",
     "unlocks": ["Full-stack roles", "Freelance readiness", "Startup-track jobs"],
     "roadmap": [
         {"stage": "Frontend Core", "weeks": 4, "topics": ["HTML semantics & a11y", "CSS: flexbox, grid, responsive", "JavaScript DOM & fetch", "React fundamentals"], "project": "Responsive portfolio site", "checkpoint": "Pixel-close clone of a real landing page"},
         {"stage": "Backend Core", "weeks": 4, "topics": ["Node.js or Python server", "REST design & status codes", "SQL/PostgreSQL modeling", "Auth: sessions & JWT"], "project": "API with auth for your portfolio data", "checkpoint": "CRUD API with protected routes"},
         {"stage": "Full Integration", "weeks": 5, "topics": ["React + API state (React Query/Redux)", "File uploads & pagination", "Env config & secrets", "Testing pyramid basics"], "project": "Full-stack job tracker", "checkpoint": "End-to-end feature shipped solo"},
         {"stage": "Ship & Interview", "weeks": 3, "topics": ["Docker & deploy (Vercel/Railway/Render)", "CI basics", "Lighthouse & performance", "Project walkthrough practice"], "project": "Deployed product with CI badge", "checkpoint": "Live demo in a mock interview"},
     ]},
    {"slug": "dbms-sql", "name": "Databases & SQL", "icon": "🗄️", "demand_index": 96,
     "blurb": "Asked in every interview and used in every real product. Normalization to window functions to tuning.",
     "unlocks": ["Data analyst roles", "Backend eligibility", "Power BI / analytics stack"],
     "roadmap": [
         {"stage": "Relational Basics", "weeks": 3, "topics": ["ER modeling", "DDL & DML", "SELECT & JOINs", "Aggregations"], "project": "College DB design + 50 queries", "checkpoint": "3NF design from a case study"},
         {"stage": "Intermediate SQL", "weeks": 3, "topics": ["Subqueries & CTEs", "Views & constraints", "Indexing basics", "Transactions & ACID"], "project": "Reporting query pack", "checkpoint": "Top-50 SQL questions solved"},
         {"stage": "Advanced & Tuning", "weeks": 4, "topics": ["Window functions", "Query plans & optimization", "Partitioning", "NoSQL when & why"], "project": "10× speedup with proof", "checkpoint": "Explain & fix a slow query live"},
         {"stage": "Interview Ready", "weeks": 2, "topics": ["Leetcode SQL 50", "Schema design rounds", "Case studies (metrics & funnels)", "Tricky puzzles"], "project": "2 mock SQL interviews", "checkpoint": "Pass a 45-min SQL round"},
     ]},
    {"slug": "cloud-devops", "name": "Cloud & DevOps", "icon": "☁️", "demand_index": 92,
     "blurb": "Docker, CI/CD, cloud platforms and monitoring — the multiplier on every other skill.",
     "unlocks": ["DevOps roles", "Platform engineering", "Production credibility"],
     "roadmap": [
         {"stage": "Linux & Networking", "weeks": 3, "topics": ["Shell fluency", "SSH, ports, DNS, HTTP", "Processes & systemd", "Users & permissions"], "project": "VPS from scratch hosting a static site", "checkpoint": "Rescue a 'broken' server task list"},
         {"stage": "Containers & CI", "weeks": 4, "topics": ["Docker images & compose", "GitHub Actions pipelines", "Registries & tagging", "Testing in CI"], "project": "Containerize a full-stack app with CI", "checkpoint": "Green pipeline on every push"},
         {"stage": "Cloud Platform", "weeks": 5, "topics": ["One cloud deep (AWS/Azure/GCP)", "Compute, storage, managed DBs", "IAM & security groups", "Cost basics"], "project": "Production deployment with managed DB", "checkpoint": "Live URL with HTTPS & backups"},
         {"stage": "Ops & Scale", "weeks": 4, "topics": ["Monitoring (logs/metrics/alerts)", "Kubernetes fundamentals", "IaC taste (Terraform)", "Incident walkthrough practice"], "project": "Monitoring dashboard + alert rule", "checkpoint": "Explain your infra in a mock interview"},
     ]},
    {"slug": "data-ai", "name": "Data Analytics & AI", "icon": "🤖", "demand_index": 94,
     "blurb": "pandas → visualization → ML fundamentals → LLM apps. The fastest-growing fresher market.",
     "unlocks": ["Data analyst roles", "ML engineering path", "AI product roles"],
     "roadmap": [
         {"stage": "Analytics Core", "weeks": 3, "topics": ["Python/pandas fundamentals", "Cleaning & EDA", "SQL for analytics", "Storytelling with charts"], "project": "EDA report on a public dataset", "checkpoint": "Insight deck from raw CSV"},
         {"stage": "Visualization & BI", "weeks": 3, "topics": ["Matplotlib/Plotly", "Power BI or Tableau", "Dashboards & KPIs", "Stakeholder framing"], "project": "Interactive BI dashboard", "checkpoint": "Dashboard answers 10 business questions"},
         {"stage": "ML Fundamentals", "weeks": 5, "topics": ["Regression & classification", "Train/test & metrics", "scikit-learn pipelines", "Feature engineering"], "project": "Placement predictor model (like ACE!)", "checkpoint": "Beat a baseline with justified metrics"},
         {"stage": "AI Engineering", "weeks": 4, "topics": ["Neural nets & TensorFlow basics", "LLM APIs & prompt patterns", "RAG introduction", "Evaluation & guardrails"], "project": "RAG chatbot over your notes", "checkpoint": "Demo an AI feature end-to-end"},
     ]},
    {"slug": "mobile", "name": "Mobile Development", "icon": "📱", "demand_index": 80,
     "blurb": "Android (Kotlin), iOS (Swift) or cross-platform (Flutter/React Native). Pick one lane, ship two apps.",
     "unlocks": ["Mobile developer roles", "Freelance app work", "Startup mobile tracks"],
     "roadmap": [
         {"stage": "Language & Toolchain", "weeks": 3, "topics": ["Kotlin / Dart / Swift basics", "IDE & emulator setup", "UI toolkit basics", "Debugging on device"], "project": "Hello-world to utility app", "checkpoint": "App runs on a real phone"},
         {"stage": "App Fundamentals", "weeks": 4, "topics": ["Navigation & screens", "State & lifecycle", "Forms & persistence", "Permissions"], "project": "Multi-screen note app with storage", "checkpoint": "Survives rotation & backgrounding"},
         {"stage": "Data & APIs", "weeks": 4, "topics": ["REST integration", "Local DB (Room/Hive/SQLite)", "Auth flows", "Push notifications"], "project": "API-backed social feed app", "checkpoint": "Login → feed → detail flow complete"},
         {"stage": "Ship & Polish", "weeks": 4, "topics": ["Play Store / App Store flow", "Crash analytics", "Performance profiling", "Interview app walkthrough"], "project": "Published app (internal testing counts)", "checkpoint": "Live listing + demo video"},
     ]},
    {"slug": "cybersecurity", "name": "Cybersecurity", "icon": "🛡️", "demand_index": 88,
     "blurb": "Offensive and defensive security — a severe talent shortage in India and government prioritized sector.",
     "unlocks": ["SOC analyst roles", "Pen-testing track", "Security compliance roles"],
     "roadmap": [
         {"stage": "Security Fundamentals", "weeks": 3, "topics": ["CIA triad & threat models", "Networking & ports review", "Linux hardening basics", "Crypto primitives"], "project": "Hardened personal VPS checklist", "checkpoint": "Explain OWASP Top 10 in your words"},
         {"stage": "Web Security", "weeks": 4, "topics": ["OWASP Top 10 hands-on", "Burp Suite basics", "SQLi & XSS labs", "Auth & session attacks"], "project": "Complete 20 PortSwigger labs", "checkpoint": "Find & document 3 intentionally-planted bugs"},
         {"stage": "Defensive Ops", "weeks": 4, "topics": ["Log analysis & SIEM", "Incident response flow", "Vulnerability scanning", "Compliance basics (ISO/DPDP)"], "project": "Home SIEM with alert rules", "checkpoint": "Triage a simulated incident"},
         {"stage": "Certification Track", "weeks": 4, "topics": ["CEH / CompTIA Security+ syllabus", "CTF practice (TryHackMe)", "Report writing", "Interview scenarios"], "project": "Write 2 professional pentest reports", "checkpoint": "Top 30% on a public CTF"},
     ]},
    {"slug": "system-design", "name": "System Design (HLD + LLD)", "icon": "🏗️", "demand_index": 89,
     "blurb": "The senior-engineer filter. Low-level design for freshers, high-level architecture for experienced rounds.",
     "unlocks": ["Product-company senior rounds", "Machine coding rounds", "Architect track"],
     "roadmap": [
         {"stage": "LLD (OOP Design)", "weeks": 3, "topics": ["SOLID principles", "Design patterns (10 core)", "UML & class diagrams", "Machine coding practice"], "project": "Parking lot + splitwise in code", "checkpoint": "Working code in 90 min for a classic LLD"},
         {"stage": "Backend Building Blocks", "weeks": 3, "topics": ["Load balancing", "Caching (Redis) & CDNs", "SQL vs NoSQL tradeoffs", "Message queues"], "project": "Add cache + queue to a real project", "checkpoint": "Justify each infra choice"},
         {"stage": "HLD Framework", "weeks": 4, "topics": ["Back-of-envelope math", "Scaling reads vs writes", "Sharding & replication", "Consistency models"], "project": "Design docs: URL shortener, chat, feed", "checkpoint": "Full whiteboard in 45 min"},
         {"stage": "Interview Ready", "weeks": 3, "topics": ["Classic systems deep-dives", "Tradeoff articulation", "Mock design interviews", "Company-specific focuses"], "project": "6 recorded mock designs", "checkpoint": "Pass a senior-level mock design"},
     ]},
]


def _find_language(slug: str) -> dict[str, Any] | None:
    return next((l for l in LANGUAGES if l["slug"] == slug), None)


def _find_track(slug: str) -> dict[str, Any] | None:
    return next((t for t in SKILL_TRACKS if t["slug"] == slug), None)


# ----------------------------------------------------------------- endpoints
@router.get("/languages")
async def list_languages():
    return {"count": len(LANGUAGES), "languages": [
        {k: l[k] for k in ("slug", "name", "icon", "family", "demand_index", "avg_ctc_band", "blurb")}
        for l in LANGUAGES
    ]}


@router.get("/languages/{slug}")
async def language_detail(slug: str):
    lang = _find_language(slug)
    if not lang:
        raise HTTPException(404, f"Language '{slug}' not found")
    return lang


@router.get("/tracks")
async def list_tracks():
    return {"count": len(SKILL_TRACKS), "tracks": [
        {k: t[k] for k in ("slug", "name", "icon", "demand_index", "blurb")}
        for t in SKILL_TRACKS
    ]}


@router.get("/tracks/{slug}")
async def track_detail(slug: str):
    track = _find_track(slug)
    if not track:
        raise HTTPException(404, f"Track '{slug}' not found")
    return track


@router.get("/company/{name}")
async def company_roadmap(name: str):
    """Preparation roadmap generated from the company's REAL placement-database row:
    difficulty, rounds, key skills and CTC band drive the stages."""
    from .main import fetch_companies  # late import avoids a circular init cycle

    companies = await fetch_companies(limit=1000)
    target = None
    q = name.lower().strip()
    for c in companies:
        if str(c.get("name", "")).lower() == q:
            target = c
            break
    if not target:
        for c in companies:
            if q in str(c.get("name", "")).lower():
                target = c
                break
    if not target:
        raise HTTPException(404, f"Company '{name}' not in placement database")

    diff_pct = int(target.get("difficulty_pct") or 50)
    diff_cat = str(target.get("difficulty_cat") or "MEDIUM").upper()
    key_skills = [s.strip() for s in str(target.get("key_skills") or "").split(",") if s.strip()]
    rounds = [r.strip() for r in str(target.get("rounds_desc") or "").split("+") if r.strip()]
    ctc_band = target.get("ctc_band") or "₹6 - ₹12 LPA"

    stage1_topics = [
        f"{skill} — deep revision + 15 practice problems" for skill in key_skills[:4]
    ] or ["Core CS fundamentals revision"]
    prep_weeks = max(4, diff_pct // 8)
    mock_count = max(2, diff_pct // 12)

    roadmap = [
        {"stage": "Know the Target", "weeks": 1,
         "topics": [
             f"Difficulty benchmark: {diff_cat} ({diff_pct}/100)",
             f"Process: {' · '.join(rounds) if rounds else 'Standard multi-round process'}",
             f"Compensation band: {ctc_band} — set your negotiation floor",
             "Read 10 recent candidate experiences (Glassdoor/Leetcode discuss)",
         ],
         "project": "One-page company intel sheet", "checkpoint": "You can describe the full process from memory"},
        {"stage": "Skill Foundations", "weeks": max(3, prep_weeks - 3),
         "topics": stage1_topics,
         "project": "Skill-by-skill problem bank (tagged)", "checkpoint": "Self-rate 7+/10 on every listed skill"},
        {"stage": "Round-by-Round Prep", "weeks": max(2, prep_weeks - 2),
         "topics": [
             f"Prep for: {r}" for r in rounds
         ] or ["Technical rounds", "HR round"],
         "project": "Rehearse each round format exactly", "checkpoint": "Timed dry-run of every round type"},
        {"stage": "Mock gauntlet", "weeks": 2,
         "topics": [
             f"{mock_count}+ full-length mock OAs at {diff_cat.lower()} difficulty",
             "Recorded mock interviews with review",
             f"Reverse-solve previous papers (crowd-sourced sets)",
             "Weakness log → targeted repair loops",
         ],
         "project": f"{mock_count}-mock gauntlet with score tracking", "checkpoint": f"Consistent {max(50, diff_pct - 5)}%+ on mocks"},
        {"stage": "Offer & Negotiation", "weeks": 1,
         "topics": [
             f"Band analysis: {ctc_band} — anchor at the upper third",
             "Competing-offer framing & timelines",
             f"{target.get('type', 'Company')}-specific joining criteria review",
             "Questions to ask that signal seniority",
         ],
         "project": "Negotiation script + BATNA notes", "checkpoint": "Offer conversation rehearsed aloud"},
    ]
    return {
        "company": target.get("name"),
        "type": target.get("type"),
        "difficulty_cat": diff_cat,
        "difficulty_pct": diff_pct,
        "ctc_band": ctc_band,
        "rounds_desc": target.get("rounds_desc"),
        "key_skills": key_skills,
        "total_weeks": sum(s["weeks"] for s in roadmap),
        "roadmap": roadmap,
    }
