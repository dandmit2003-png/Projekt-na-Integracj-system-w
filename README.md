CompRent-SOA — Integracja SOA

CEL PROJEKTU
Integracja trzech niezależnych komponentów w architekturze SOA (Service-Oriented Architecture): aplikacja kliencka (frontend) ↔ usługa pośrednicząca ESB + broker RabbitMQ ↔ Worker + baza SQLite. Projekt realizuje zaawansowaną integrację systemów z wykorzystaniem wzorców Enterprise Integration Patterns, buforowania wiadomości oraz mechanizmów odporności na awarie.

KOMPONENTY SYSTEMU

1. Frontend (1_Frontend/index.html)
Aplikacja kliencka w HTML + JavaScript. Wysyła żądania HTTP POST do ESB z tokenem JWT (Bearer). Wyświetla katalog laptopów, formularz logowania, alert po wypożyczeniu. Komunikacja z ESB przez fetch() pod adresem http://localhost:3000.

2. ESB / Router (2_ESB_Router/esb_server.js)
Usługa pośrednicząca (Enterprise Service Bus) w Node.js + Express. Uwierzytelnianie JWT (jsonwebtoken) — endpoint /api/login generuje token, middleware authenticateToken weryfikuje go. Content-Based Router: marka 'Apple' → apple_queue, inne marki → windows_queue. Publikuje wiadomości do RabbitMQ z opcją persistent: true. Port: 3000.

3. RabbitMQ (CloudAMQP)
Broker komunikatów (Message Broker). Kolejki: apple_queue i windows_queue. Buforuje wiadomości, gdy Worker jest niedostępny (message buffering). Zapewnia asynchroniczną komunikację między ESB a Workerem.

4. Worker (3_DB_Worker/db_worker.js)
Nasłuchuje na kolejkach RabbitMQ (channel.consume). Retry Pattern: 3 próby zapisu z 2-sekundową przerwą (for (let i = 1; i <= maxRetries; i++)). Zapisuje dane do SQLite (warehouse.db, tabela rentals). Potwierdza wiadomość (channel.ack) lub zwraca do kolejki (channel.nack(msg, false, true)). Symuluje awarię bazy (30% szans), aby zademonstrować Retry Pattern.

WZORCE INTEGRACYJNE (ENTERPRISE INTEGRATION PATTERNS)
Content-Based Router — esb_server.js: routing na podstawie marki laptopa.
Message Queue — RabbitMQ: buforowanie i asynchroniczne przetwarzanie wiadomości.
Retry Pattern — db_worker.js: ponawianie prób zapisu w przypadku awarii.
Bezpieczeństwo: JWT Bearer — esb_server.js + index.html: tokeny JWT przy każdym żądaniu.

ARCHITEKTURA PRZEPŁYWU DANYCH
Przeglądarka (frontend) → HTTP POST + JWT Bearer → ESB / Router (port 3000) → Content-Based Router → RabbitMQ (apple_queue / windows_queue) → channel.consume → Worker (db_worker.js) → INSERT → SQLite (warehouse.db, tabela rentals)

URUCHOMIENIE (3 TERMINALE)

Terminal 1 — ESB (Router):
cd 2_ESB_Router
npm install
node esb_server.js
Oczekiwany wynik: ESB/Router działa na http://localhost:3000 oraz Połączono z RabbitMQ. Kolejki gotowe.

Terminal 2 — Worker (Baza):
cd 3_DB_Worker
npm install
node db_worker.js
Oczekiwany wynik: Baza warehouse.db gotowa oraz Worker nasłuchuje na kolejkach RabbitMQ...

Terminal 3 — Frontend (Strona):
cd 1_Frontend
npx serve -l 3001
Otwórz w przeglądarce: http://localhost:3001

LOGOWANIE
Email: admin@comprent.pl
Hasło: admin123

TESTY INTEGRACYJNE
1. Logowanie: POST /api/login → zwraca token JWT.
2. Wypożyczenie Apple: POST /api/rent z marką Apple → wiadomość trafia do apple_queue → Worker zapisuje rekord z systemType='Apple'.
3. Wypożyczenie Acer: POST /api/rent z marką Acer → wiadomość trafia do windows_queue → Worker zapisuje rekord z systemType='Windows'.
4. Retry Pattern: symulacja awarii bazy (30% szans) → Worker ponawia zapis do 3 razy z 2-sekundową przerwą.
5. Buforowanie wiadomości: wyłączenie Workera → wiadomości czekają w RabbitMQ → po włączeniu Workera są automatycznie przetwarzane.
6. Bezpieczeństwo: żądanie bez tokenu JWT → ESB zwraca 401 Unauthorized.

WERYFIKACJA BAZY DANYCH
Po wypożyczeniu laptopów sprawdź zawartość bazy:
cd 3_DB_Worker
node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('./warehouse.db'); db.all('SELECT * FROM rentals', (err, rows) => { console.log('Liczba rekordów:', rows.length); console.log(rows); });"
Oczekiwany wynik: lista rekordów z kolumnami id, productName, brand, price, userId, rentalDate, systemType, savedAt.

WYMAGANIA SYSTEMOWE
Node.js (wersja LTS, np. 20.x lub 22.x)
CloudAMQP (darmowy plan „Little Lemur") lub lokalny RabbitMQ
VS Code (edytor kodu)
Przeglądarka (Chrome, Firefox, Edge)

STRUKTURA REPOZYTORIUM
CompRent-SOA/
├── 1_Frontend/
│   └── index.html              ← aplikacja kliencka (frontend)
├── 2_ESB_Router/
│   └── esb_server.js           ← ESB + JWT + Content-Based Router
├── 3_DB_Worker/
│    └── db_worker.js            ← Worker + Retry Pattern + SQLite
└── README.txt                  ← dokumentacja projektu
