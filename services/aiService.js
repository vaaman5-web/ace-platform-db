const config = require('../config/env');
const logger = require('../utils/logger');

function pickProvider() {
  return config.ai.provider || 'gemini';
}

async function callLLM(prompt, { temperature = 0.6, maxTokens = 6000 } = {}) {
  const provider = pickProvider();

  if (provider === 'openai') {
    if (!config.ai.openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.ai.openaiApiKey
      },
      body: JSON.stringify({
        model: config.ai.openaiModel,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: 'You are a placement-assessment engine for engineering students. You always respond with valid JSON only, no markdown fences, no commentary.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) throw new Error('OpenAI API error: ' + res.status + ' ' + await res.text());
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'groq') {
    if (!config.ai.groqApiKey) throw new Error('GROQ_API_KEY not configured');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.ai.groqApiKey
      },
      body: JSON.stringify({
        model: config.ai.groqModel,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a placement-assessment engine for engineering students. Respond with valid JSON only, no markdown fences, no commentary.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) throw new Error('Groq API error: ' + res.status + ' ' + await res.text());
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (!config.ai.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + config.ai.geminiModel + ':generateContent?key=' + config.ai.geminiApiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
      })
    }
  );
  if (!res.ok) throw new Error('Gemini API error: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('LLM returned non-JSON: ' + trimmed.slice(0, 300));
  }
}

const LANGUAGE_TOPICS = {
  'Java': ['Core Java syntax', 'OOP & Inheritance', 'Collections Framework', 'Exception handling', 'Multithreading', 'Streams & Lambdas'],
  'Python': ['Python syntax', 'Data structures (list/dict/set)', 'Functions & closures', 'Decorators & generators', 'OOP in Python', 'Libraries (NumPy/Pandas)'],
  'C++': ['C++ syntax', 'Pointers & memory', 'STL containers', 'OOP & templates', 'Move semantics', 'Algorithm basics'],
  'C': ['C syntax', 'Pointers & arrays', 'Memory management', 'Structures & unions', 'File I/O', 'Bit manipulation'],
  'JavaScript': ['JS syntax & ES6', 'Functions & closures', 'Objects & prototypes', 'Async/await & Promises', 'Array methods', 'DOM & events'],
  'SQL': ['SELECT & filtering', 'Joins', 'Subqueries & CTEs', 'GROUP BY & aggregates', 'Indexes & performance', 'Normalization']
};

/* Fallback question banks: language bank (6/lang) + shared core CS pool (24) = 30 unique per lang */
const LANG_BANKS = {
  'Java': [
    { d: 'easy', t: 'Core Java syntax', q: 'What is the output of int x = 5; System.out.println(x++ + ++x);', o: ['11', '12', '13', '10'], a: 1, e: 'x++ evaluates to 5 (x becomes 6), then ++x makes x 7; 5 + 7 = 12.' },
    { d: 'easy', t: 'OOP & Inheritance', q: 'Which keyword prevents a class from being subclassed in Java?', o: ['static', 'final', 'abstract', 'private'], a: 1, e: 'final on a class stops inheritance.' },
    { d: 'medium', t: 'Collections Framework', q: 'Which collection allows duplicate keys?', o: ['HashMap', 'TreeMap', 'LinkedHashMap', 'None of these'], a: 3, e: 'All Map implementations reject duplicate keys; the question is a trick.' },
    { d: 'medium', t: 'Exception handling', q: 'Which exception is thrown when dividing an integer by zero?', o: ['IOException', 'ArithmeticException', 'NullPointerException', 'NumberFormatException'], a: 1, e: 'Integer division by zero throws ArithmeticException at runtime.' },
    { d: 'hard', t: 'Multithreading', q: 'Which keyword guarantees visibility of changes across threads (without full atomicity)?', o: ['synchronized', 'volatile', 'transient', 'static'], a: 1, e: 'volatile ensures visibility of a shared variable across threads.' },
    { d: 'hard', t: 'Streams & Lambdas', q: 'What does stream.map(x -> x * 2).reduce(0, Integer::sum) compute on [1,2,3]?', o: ['6', '12', '10', '3'], a: 1, e: 'Doubles each element and sums: 2 + 4 + 6 = 12.' }
  ],
  'Python': [
    { d: 'easy', t: 'Python syntax', q: 'What is the output of print(2 ** 3)?', o: ['6', '8', '9', '5'], a: 1, e: '** is exponentiation, so 2 raised to 3 = 8.' },
    { d: 'easy', t: 'Python syntax', q: 'Which keyword defines a function in Python?', o: ['func', 'function', 'def', 'lambda'], a: 2, e: 'Functions are declared with the def keyword.' },
    { d: 'medium', t: 'Data structures', q: 'What does list.append() do in terms of time complexity?', o: ['O(n)', 'O(log n)', 'O(1) amortized', 'O(n^2)'], a: 2, e: 'Amortized append is O(1) on Python lists.' },
    { d: 'medium', t: 'Functions & closures', q: 'What does the nonlocal keyword do in a nested function?', o: ['Creates a global variable', 'Declares a class', 'Modifies a variable in the enclosing scope', 'Deletes a variable'], a: 2, e: 'nonlocal lets an inner function rebind a variable from its enclosing function scope.' },
    { d: 'hard', t: 'Data structures', q: 'What is the output of bool([]) and bool([0])?', o: ['True and True', 'False and True', 'True and False', 'False and False'], a: 1, e: 'An empty container is falsy; a list containing 0 is truthy since it is non-empty.' },
    { d: 'hard', t: 'Libraries', q: 'What does pandas DataFrame.isnull().sum() do?', o: ['Drops null rows', 'Counts missing values per column', 'Fills nulls with 0', 'Sorts null columns'], a: 1, e: 'isnull() flags missing cells and sum() counts them per column.' }
  ],
  'JavaScript': [
    { d: 'easy', t: 'JS syntax & ES6', q: 'Which keyword declares a block-scoped variable?', o: ['var', 'let', 'function', 'this'], a: 1, e: 'let (and const) are block-scoped; var is function-scoped.' },
    { d: 'easy', t: 'Objects & prototypes', q: 'What does typeof [] return?', o: ['"array"', '"list"', '"object"', '"undefined"'], a: 2, e: 'Arrays are objects in JavaScript, so typeof returns "object".' },
    { d: 'medium', t: 'Array methods', q: 'What will [1,2,3].map(x => x * 2) return?', o: ['[1,4,9]', '[2,4,6]', '[1,2,3]', '[3,6,9]'], a: 1, e: 'map applies the callback to each element, doubling every value.' },
    { d: 'medium', t: 'Async/await & Promises', q: 'What happens when Promise.all() rejects if one promise fails?', o: ['It resolves anyway', 'It waits forever', 'It rejects with that error immediately', 'It retries the failed promise'], a: 2, e: 'Promise.all is fail-fast: the first rejection rejects the whole aggregate.' },
    { d: 'hard', t: 'Functions & closures', q: 'What is hoisting?', o: ['Moving functions at runtime', 'Declarations being moved to the top of their scope at compile time', 'A memory leak fix', 'DOM event bubbling'], a: 1, e: 'var declarations and function declarations are hoisted to the top of scope.' },
    { d: 'hard', t: 'JS syntax & ES6', q: 'What is the difference between == and ===?', o: ['=== compares values only', '== compares type and value', '=== compares type and value without coercion', 'There is no difference'], a: 2, e: '=== is strict equality (no type coercion); == coerces types first.' }
  ],
  'C++': [
    { d: 'easy', t: 'C++ syntax', q: 'Which keyword allocates memory on the heap in C++?', o: ['malloc', 'new', 'alloc', 'make'], a: 1, e: 'new allocates and constructs objects on the heap.' },
    { d: 'easy', t: 'C++ syntax', q: 'What is the size of an int on most modern systems (bytes)?', o: ['2', '4', '8', '16'], a: 1, e: 'int is typically 4 bytes on modern systems.' },
    { d: 'medium', t: 'STL containers', q: 'What does std::vector have that a C array does not?', o: ['Fixed size', 'Dynamic resizing', 'No bounds checking ever', 'Faster hardware access'], a: 1, e: 'vector grows and shrinks automatically; C arrays are fixed-size.' },
    { d: 'medium', t: 'OOP & templates', q: 'What is a key difference between a reference and a pointer?', o: ['A reference can be null', 'A reference cannot be reassigned after binding', 'A pointer is always safer', 'References use more memory'], a: 1, e: 'A reference is bound once; a pointer can be reassigned or null.' },
    { d: 'hard', t: 'Move semantics', q: 'What is the purpose of a move constructor?', o: ['Copies all data deeply', 'Transfers resources from a temporary without copying', 'Deletes an object', 'Increases reference count'], a: 1, e: 'Move constructors transfer ownership to avoid expensive copies.' },
    { d: 'hard', t: 'Pointers & memory', q: 'What is undefined behavior?', o: ['A compile error', 'Behavior the standard does not specify', 'A runtime exception', 'A warning message'], a: 1, e: 'UB means the standard imposes no requirements on the program outcome.' }
  ],
  'C': [
    { d: 'easy', t: 'C syntax', q: 'Which header is required for printf()?', o: ['string.h', 'stdlib.h', 'stdio.h', 'math.h'], a: 2, e: 'printf is declared in stdio.h.' },
    { d: 'easy', t: 'Pointers & arrays', q: 'What does the & operator do in C?', o: ['Multiplication', 'Address-of', 'Logical AND', 'Dereference'], a: 1, e: 'The unary & yields the memory address of its operand.' },
    { d: 'medium', t: 'Memory management', q: 'What does malloc() return when it fails?', o: ['0', 'NULL', 'A valid pointer to empty memory', 'EXIT_FAILURE'], a: 1, e: 'malloc returns NULL on allocation failure.' },
    { d: 'medium', t: 'Structures & unions', q: 'What terminates a C string?', o: ['\n', '\\0', 'EOF', 'Space'], a: 1, e: 'C strings are null-terminated with \'\\0\'.' },
    { d: 'hard', t: 'Pointers & memory', q: 'What is a dangling pointer?', o: ['A pointer to a constant', 'A pointer that still points to freed memory', 'A null pointer', 'A void pointer'], a: 1, e: 'Using a dangling pointer (after free) is undefined behavior.' },
    { d: 'hard', t: 'Pointers & arrays', q: 'What is the size of a pointer on a typical 64-bit system?', o: ['4 bytes', '8 bytes', '16 bytes', 'Depends on the variable type it points to only'], a: 1, e: 'Pointers are 8 bytes on 64-bit systems regardless of pointee.' }
  ],
  'SQL': [
    { d: 'easy', t: 'SELECT & filtering', q: 'Which clause is used to filter rows in SQL?', o: ['GROUP BY', 'WHERE', 'HAVING', 'ORDER BY'], a: 1, e: 'WHERE filters rows before grouping and aggregation.' },
    { d: 'easy', t: 'SELECT & filtering', q: 'Which keyword sorts the result set?', o: ['SORT BY', 'ORDER BY', 'GROUP BY', 'FILTER BY'], a: 1, e: 'ORDER BY sorts results ascending or descending.' },
    { d: 'medium', t: 'Joins', q: 'Which join returns every row from the left table plus matching rows on the right?', o: ['INNER JOIN', 'RIGHT JOIN', 'LEFT JOIN', 'CROSS JOIN'], a: 2, e: 'LEFT JOIN keeps all left rows, filling NULLs where no match exists.' },
    { d: 'medium', t: 'GROUP BY & aggregates', q: 'What does GROUP BY do?', o: ['Sorts the table', 'Combines rows into groups for aggregate functions', 'Deletes duplicates', 'Adds an index'], a: 1, e: 'GROUP BY groups rows so aggregates like COUNT/SUM apply per group.' },
    { d: 'hard', t: 'SELECT & filtering', q: 'What is the difference between WHERE and HAVING?', o: ['They are identical', 'WHERE filters after grouping, HAVING before', 'WHERE filters before grouping, HAVING after', 'HAVING only sorts'], a: 2, e: 'WHERE applies to base rows; HAVING filters grouped results.' },
    { d: 'hard', t: 'Indexes & performance', q: 'What does a primary key guarantee?', o: ['Fast sorting only', 'Uniqueness of each row and non-null values', 'Automatic indexes on all columns', 'Foreign key relationships'], a: 1, e: 'A primary key is unique and not null for every row.' }
  ]
};

const CORE_CS_POOL = [
  { d: 'easy', t: 'Data Structures', q: 'Which data structure follows FIFO order?', o: ['Stack', 'Queue', 'Tree', 'Hash Set'], a: 1, e: 'Queues are First-In-First-Out.' },
  { d: 'easy', t: 'Data Structures', q: 'Which data structure follows LIFO order?', o: ['Queue', 'Stack', 'Linked List', 'Binary Heap'], a: 1, e: 'Stacks are Last-In-First-Out.' },
  { d: 'easy', t: 'Algorithms', q: 'What is the time complexity of accessing an array element by index?', o: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], a: 1, e: 'Array indexing is constant time.' },
  { d: 'easy', t: 'Algorithms', q: 'Which sorting algorithm has average time complexity O(n log n)?', o: ['Bubble Sort', 'Insertion Sort', 'Merge Sort', 'Selection Sort'], a: 2, e: 'Merge Sort (and Quick Sort average) run in O(n log n).' },
  { d: 'easy', t: 'Web', q: 'Which HTTP method is used to fetch a resource?', o: ['POST', 'GET', 'PUT', 'DELETE'], a: 1, e: 'GET retrieves a resource.' },
  { d: 'easy', t: 'Databases', q: 'What does SQL stand for?', o: ['Structured Query Language', 'Simple Query Language', 'Sequential Query Logic', 'Standard Quantified Language'], a: 0, e: 'SQL = Structured Query Language.' },
  { d: 'easy', t: 'Computer Basics', q: 'What does CPU stand for?', o: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processor Unit'], a: 0, e: 'CPU = Central Processing Unit.' },
  { d: 'easy', t: 'Networking', q: 'What is the base of binary numbers?', o: ['8', '10', '2', '16'], a: 2, e: 'Binary uses base 2 (digits 0 and 1).' },
  { d: 'easy', t: 'Data Structures', q: 'Which of these is an unordered collection of unique elements?', o: ['Array', 'List', 'Set', 'Queue'], a: 2, e: 'A Set stores unique, unordered elements.' },
  { d: 'easy', t: 'Programming', q: 'What does variable scope refer to?', o: ['Memory size', 'Where a variable can be accessed', 'Data type', 'Loop count'], a: 1, e: 'Scope defines the region where a variable is visible.' },
  { d: 'medium', t: 'Algorithms', q: 'What is the worst-case time complexity of Quick Sort?', o: ['O(n log n)', 'O(n)', 'O(n^2)', 'O(log n)'], a: 2, e: 'Poor pivot choices give worst-case O(n^2), e.g., on already-sorted input.' },
  { d: 'medium', t: 'Algorithms', q: 'Which searching algorithm requires a sorted array?', o: ['Linear Search', 'Binary Search', 'Hashing', 'DFS'], a: 1, e: 'Binary search repeatedly halves a sorted range.' },
  { d: 'medium', t: 'Algorithms', q: 'What is memoization used for?', o: ['Encrypting data', 'Caching computed results to avoid rework', 'Compressing memory', 'Sorting faster'], a: 1, e: 'Memoization caches function results for repeated calls.' },
  { d: 'medium', t: 'Algorithms', q: 'What is the time complexity of binary search?', o: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], a: 1, e: 'Binary search is O(log n) on a sorted array.' },
  { d: 'medium', t: 'Databases', q: 'What is the purpose of an index in a database?', o: ['To store backups', 'To speed up lookups', 'To reduce disk usage always', 'To add constraints only'], a: 1, e: 'Indexes accelerate SELECT lookups at the cost of extra writes.' },
  { d: 'medium', t: 'Databases', q: 'What is a transaction in a database?', o: ['A stored procedure', 'An atomic unit of work with ACID properties', 'A backup file', 'A table join'], a: 1, e: 'Transactions are atomic, consistent, isolated and durable.' },
  { d: 'medium', t: 'Operating Systems', q: 'What is a deadlock?', o: ['A crashed program', 'Two or more processes each waiting on a resource held by the other', 'A memory leak', 'A slow query'], a: 1, e: 'Deadlock is circular wait on held resources.' },
  { d: 'medium', t: 'OOP', q: 'What is polymorphism?', o: ['Hiding data', 'One interface, many implementations', 'Creating multiple objects', 'Inheriting a base class'], a: 1, e: 'Polymorphism lets one interface behave differently across types.' },
  { d: 'medium', t: 'Algorithms', q: 'What is the time complexity of a hash map lookup (average)?', o: ['O(n)', 'O(1)', 'O(log n)', 'O(n log n)'], a: 1, e: 'Average hash lookups are O(1).' },
  { d: 'medium', t: 'Data Structures', q: 'What is a hash collision?', o: ['Two keys mapping to the same bucket', 'Two arrays with the same name', 'A memory error', 'A null key'], a: 0, e: 'Collisions occur when distinct keys hash to the same slot.' },
  { d: 'hard', t: 'Data Structures', q: 'What is the time complexity of accessing the middle of a singly linked list?', o: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'], a: 2, e: 'You must traverse from the head, so it is O(n).' },
  { d: 'hard', t: 'Algorithms', q: 'Which algorithm finds the shortest path in a weighted graph using a priority queue?', o: ['DFS', 'BFS', 'Dijkstra', 'Floyd-Warshall'], a: 2, e: 'Dijkstra expands the nearest unvisited node via a priority queue.' },
  { d: 'hard', t: 'Algorithms', q: 'What is dynamic programming best suited for?', o: ['Sorting arrays', 'Problems with overlapping subproblems and optimal substructure', 'Compressing files', 'Parsing HTML'], a: 1, e: 'DP reuses solutions of overlapping subproblems.' },
  { d: 'hard', t: 'Databases', q: 'What does the CAP theorem describe?', o: ['Trade-offs among Consistency, Availability and Partition tolerance', 'Three ways to index', 'A backup strategy', 'SQL isolation levels'], a: 0, e: 'CAP states a distributed system cannot have all three simultaneously.' },
  { d: 'hard', t: 'Databases', q: 'What is database normalization used for?', o: ['Making queries slower for safety', 'Reducing redundancy and maintaining integrity', 'Storing binary data', 'Encrypting passwords'], a: 1, e: 'Normalization removes redundancy and anomalies via normal forms.' },
  { d: 'hard', t: 'Operating Systems', q: 'What is virtual memory?', o: ['RAM that never powers off', 'Abstracting memory so disk is used as an extension of RAM', 'A cache for the CPU', 'A type of ROM'], a: 1, e: 'Virtual memory maps procks of RAM and disk into one address space.' },
  { d: 'hard', t: 'Operating Systems', q: 'What is the key difference between a process and a thread?', o: ['Threads are slower', 'Processes have separate memory spaces; threads in a process share memory', 'Threads cannot run', 'Processes cannot run'], a: 1, e: 'Threads within a process share the process memory space.' },
  { d: 'hard', t: 'Algorithms', q: 'What is the space complexity of a recursive binary tree traversal at depth h?', o: ['O(1)', 'O(n)', 'O(h)', 'O(n^2)'], a: 2, e: 'The call stack grows to the tree height h.' },
  { d: 'hard', t: 'Data Structures', q: 'Which structure lets you find the largest element in O(1) with O(log n) inserts?', o: ['Sorted array', 'Max-heap', 'Hash map', 'Linked list'], a: 1, e: 'A max-heap gives O(1) max access and O(log n) insert.' },
  { d: 'hard', t: 'Networking', q: 'What is a TCP three-way handshake?', o: ['SYN, SYN-ACK, ACK', 'ACK, ACK, ACK', 'GET, POST, PUT', 'FIN, RST, ACK'], a: 0, e: 'Connection setup uses SYN, SYN-ACK, then ACK.' }
];

function fallbackQuestionBank(lang) {
  const langItems = LANG_BANKS[lang] || LANG_BANKS['Java'];
  const pool = [...langItems, ...CORE_CS_POOL];
  return pool.map((item, i) => ({ id: i + 1, difficulty: item.d, topic: item.t, question: item.q, options: item.o, answer: item.a, explanation: item.e }));
}

const QUIZ_CACHE_TTL_MS = 10 * 60 * 1000;
const QUIZ_CALL_TIMEOUT_MS = 55000;
const quizCache = new Map();

function quizCacheKey(profile) {
  const cgpaBand = Math.max(1, Math.min(10, Math.floor((parseFloat(profile.cgpa) || 7) / 0.5) + 1));
  return [profile.primary_lang || 'Java', profile.target_track || 'x', cgpaBand].join('|');
}

function buildQuizPrompt(profile) {
  const lang = profile.primary_lang || 'Java';
  const topics = (LANGUAGE_TOPICS[lang] || LANGUAGE_TOPICS['Java']).join(', ');
  const cgpa = parseFloat(profile.cgpa) || 7.0;
  const track = profile.target_track || 'general engineering';

  return `Generate 30 multiple-choice placement questions for an engineering student: 10 EASY, 10 MEDIUM and 10 HARD.

Student profile:
- Name: ${profile.candidate_name || 'candidate'}
- Degree: ${profile.degree || 'B.Tech'}
- CGPA: ${cgpa}
- Primary programming language: ${lang}
- Target placement track: ${track}

Topic scope for ${lang}: ${topics}.

Return ONLY a JSON object with this exact shape (no markdown):
{
  "questions": [
    {
      "id": 1,
      "difficulty": "easy",
      "topic": "topic name",
      "question": "full question text",
      "options": ["a", "b", "c", "d"],
      "answer": 0
    }
  ]
}

Rules:
- EXACTLY 30 questions: 10 with difficulty "easy", 10 with "medium", 10 with "hard".
- EASY = basic syntax and core concepts. MEDIUM = applied logic and moderate problem solving. HARD = tricky edge cases and strong problem solving.
- "answer" must be the 0-based index of the correct option (0-3).
- Keep each question text concise. No explanation field is required.
- Questions must be answerable without running code and reflect real interview difficulty for ${track}.
`;
}

async function generateQuizQuestions(profile) {
  const lang = profile.primary_lang || 'Java';
  const key = quizCacheKey(profile);
  const hit = quizCache.get(key);
  if (hit && Date.now() - hit.ts < QUIZ_CACHE_TTL_MS) {
    logger.info('Serving cached quiz for profile key ' + key);
    return hit.questions.map(q => ({ ...q }));
  }

  const difficulties = ['easy', 'medium', 'hard'];
  const bank = fallbackQuestionBank(lang);
  let llmQuestions = [];

  try {
    const raw = await Promise.race([
      callLLM(buildQuizPrompt(profile), { temperature: 0.7, maxTokens: 9000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout after ' + QUIZ_CALL_TIMEOUT_MS + 'ms')), QUIZ_CALL_TIMEOUT_MS))
    ]);
    const parsed = parseJsonResponse(raw);
    const list = Array.isArray(parsed.questions) ? parsed.questions : [];
    llmQuestions = list
      .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
      .map(q => ({
        difficulty: difficulties.indexOf(q.difficulty) >= 0 ? q.difficulty : 'easy',
        topic: q.topic || 'general',
        question: q.question,
        options: q.options.slice(0, 4),
        answer: typeof q.answer === 'number' ? Math.max(0, Math.min(3, Math.round(q.answer))) : 0,
        explanation: q.explanation || ''
      }));
    if (llmQuestions.length < 10) throw new Error('LLM returned too few questions: ' + llmQuestions.length);
  } catch (err) {
    llmQuestions = [];
    logger.warn('LLM quiz generation failed or timed out; using curated pool', { error: err.message });
  }

  /* Guarantee exactly 30 questions, 10 per difficulty, topping up from the curated pool */
  const questions = [];
  difficulties.forEach(d => {
    const have = llmQuestions.filter(q => q.difficulty === d).slice(0, 10);
    questions.push(...have);
    if (have.length < 10) {
      questions.push(...shuffle(bank.filter(b => b.difficulty === d)).slice(0, 10 - have.length));
    }
  });

  const finalQuestions = questions.slice(0, 30).map((item, i) => ({
    id: i + 1,
    difficulty: item.difficulty,
    topic: item.topic,
    question: item.question,
    options: item.options,
    answer: item.answer,
    explanation: item.explanation || ''
  }));
  quizCache.set(key, { ts: Date.now(), questions: finalQuestions });
  return finalQuestions;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPlanPrompt(profile, results) {
  const score = results.score || 0;
  const weak = Array.isArray(results.weak_topics) && results.weak_topics.length
    ? results.weak_topics.join(', ')
    : 'not specified';
  const strong = Array.isArray(results.strong_topics) && results.strong_topics.length
    ? results.strong_topics.join(', ')
    : 'not specified';
  const lang = profile.primary_lang || 'Java';

  return `Create a personalized full study plan and roadmap for an engineering student preparing for placements.

Student profile:
- Name: ${profile.candidate_name || 'candidate'}
- Degree: ${profile.degree || 'B.Tech'}
- CGPA: ${profile.cgpa || 7.0}
- Primary language: ${lang}
- Target track: ${profile.target_track || 'general engineering'}
- Mock quiz score: ${score}% (easy/medium/hard mix in ${lang})
- Weak areas: ${weak}
- Strong areas: ${strong}

Return ONLY JSON (no markdown) with exactly this shape:
{
  "plan_summary": "one paragraph summarizing the approach",
  "level": "Foundation | Accelerator | Mastery",
  "total_weeks": 6,
  "roadmap": [
    {
      "week": 1,
      "focus": "week theme",
      "days": [
        { "day": 1, "task": "specific task for today", "topic": "topic", "resource": "free online resource suggestion", "duration_minutes": 60 }
      ],
      "milestone_project": "hands-on mini project for this week",
      "assessment": "self-test to take at the end of the week"
    }
  ]
}

Rules:
- Tune duration by score: score < 40 → 6 weeks, 40-70 → 4 weeks, > 70 → 3 weeks (set total_weeks accordingly).
- Each week has 7 days with concrete daily tasks, ordered by dependency.
- Each day has one task (specific, actionable), a topic, a free resource, and a duration in minutes.
- Prioritise the weak topics while protecting the strong ones.
- The roadmap must end with a capstone project and a final self-assessment.
`;
}

async function generateStudyPlan(profile, results) {
  try {
    const prompt = buildPlanPrompt(profile, results);
    const raw = await callLLM(prompt, { temperature: 0.5 });
    const parsed = parseJsonResponse(raw);
    if (!Array.isArray(parsed.roadmap) || parsed.roadmap.length === 0) {
      throw new Error('LLM returned an invalid study plan');
    }
    return {
      plan_summary: parsed.plan_summary || 'Personalised study plan generated.',
      level: parsed.level || 'Foundation',
      total_weeks: parsed.total_weeks || parsed.roadmap.length,
      roadmap: parsed.roadmap
    };
  } catch (err) {
    logger.warn('LLM plan generation failed, using fallback plan', { error: err.message });
    return fallbackStudyPlan(profile, results);
  }
}

function fallbackStudyPlan(profile, results) {
  const score = results.score || 0;
  const lang = profile.primary_lang || 'Java';
  const weak = (results.weak_topics || []).slice(0, 2);
  const weeks = score < 40 ? 6 : score <= 70 ? 4 : 3;
  const themes = [
    ['Core ' + lang + ' syntax & OOP', 'Re-learn core syntax, data types, classes and inheritance. Solve 10 pattern problems.'],
    ['Data Structures & Algorithms', 'Arrays, strings, linked lists, stacks, queues, sorting and searching. 2-3 problems per day.'],
    ['Problem Solving Practice', 'Recursion, two-pointers, sliding window. Daily timed practice on LeetCode / GfG.'],
    ['Database & SQL', 'SELECT, WHERE, joins, GROUP BY, subqueries. Complete 20 SQL queries.'],
    ['Build a Mini Project', 'Build one mini project in ' + lang + ' applying your weak topics end-to-end.'],
    ['Mock Tests & Polish', 'Take 2 timed mocks, review explanations, refine weak topics.']
  ];
  if (weak.length) themes[0] = [weak[0] + ' deep-dive', 'Focused practice on ' + weak.join(', ') + ' with daily drills and examples.'];
  const roadmap = [];
  for (let w = 1; w <= weeks; w++) {
    const def = themes[(w - 1) % themes.length];
    const days = [];
    for (let d = 1; d <= 7; d++) {
      days.push({
        day: d,
        task: d % 3 === 0
          ? 'Solve 2-3 practice problems on ' + def[0].split('(')[0].trim()
          : (d % 2 === 0 ? 'Practice: ' + def[1].split('.')[0] + ' (2 problems)' : 'Study: ' + def[1].split('.')[0] + ' — revise notes'),
        topic: def[0].split('(')[0].trim(),
        resource: 'freeCodeCamp / GeeksforGeeks / YouTube',
        duration_minutes: d % 7 === 6 ? 90 : 60
      });
    }
    roadmap.push({
      week: w,
      focus: def[0],
      days,
      milestone_project: def[1],
      assessment: 'End-of-week 10-question self-test on ' + def[0].split('(')[0].trim() + '.'
    });
  }
  return {
    plan_summary: 'A structured, profile-verified plan prioritising ' + (weak.join(', ') || lang + ' fundamentals') + '. Mark each day complete to track your progress.',
    level: score >= 70 ? 'Mastery' : score >= 45 ? 'Accelerator' : 'Foundation',
    total_weeks: weeks,
    roadmap
  };
}

module.exports = { generateQuizQuestions, generateStudyPlan, callLLM };