// ==============================
// メモライ
// ==============================


// ------------------------------
// サンプルカード
// ------------------------------

const sampleCards = [
  {
    id: 1,
    question: "光合成を行う細胞小器官は？",
    answer: "葉緑体",
    subject: "生物"
  },
  {
    id: 2,
    question: "DNAの二重らせん構造を提唱した2人は？",
    answer: "ワトソンとクリック",
    subject: "生物"
  },
  {
    id: 3,
    question: "日本の初代内閣総理大臣は？",
    answer: "伊藤博文",
    subject: "日本史"
  },
  {
    id: 4,
    question: "「apple」の日本語訳は？",
    answer: "りんご",
    subject: "英語"
  },
  {
    id: 5,
    question: "三平方の定理を表す式は？",
    answer: "a² + b² = c²",
    subject: "数学"
  }
];


// ------------------------------
// 文字を画面に安全に出す
// ------------------------------

// カードの問題・答えなど、利用者が入力した文字は必ずこれを通してから innerHTML に入れる
// （他の人が作ったカードに <script> などが仕込まれていても、ただの文字として表示する）
function escapeHTML(text) {

  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// ------------------------------
// カード取得・保存
// ------------------------------

// 最初から入っているカード（サンプル＋英単語＋科目別）
function getDefaultCards() {

  // englishWords.js / subjectCards.js が読み込まれていなくても動くようにする
  const words =
    typeof englishWords === "undefined"
      ? []
      : englishWords;

  const others =
    typeof subjectCards === "undefined"
      ? []
      : subjectCards;

  return [...sampleCards, ...words, ...others];
}


function getCards() {
  const savedCards = localStorage.getItem("memorai_cards");

  if (savedCards) {
    const parsedCards = JSON.parse(savedCards);

    // 最初から入っているカードのうち、まだ保存されていない id だけ追加する
    // （既存カードと学習記録はそのまま）
    const mergedCards = [...parsedCards];

    const savedById =
      new Map(parsedCards.map(card => [card.id, card]));

    let changed = false;

    getDefaultCards().forEach(defaultCard => {

      const savedCard =
        savedById.get(defaultCard.id);

      if (!savedCard) {
        mergedCards.push({
          ...defaultCard
        });

        changed = true;

      } else if (defaultCard.type && !savedCard.type) {

        // 以前保存した英単語には type がないので補う（学習記録はそのまま）
        savedCard.type = defaultCard.type;

        changed = true;
      }
    });

    // 変更があったときだけ保存
    if (changed) {
      saveCards(mergedCards);
    }

    return mergedCards;
  }

  const initialCards =
    getDefaultCards().map(card => ({ ...card }));

  saveCards(initialCards);

  return initialCards;
}


function saveCards(cardsToSave) {

  localStorage.setItem(
    "memorai_cards",
    JSON.stringify(cardsToSave)
  );
}


// ------------------------------
// カードを1枚だけ更新
// ★今回のバグ対策
// 全カードを読み直し、id が同じカードだけ差し替えて保存する
// ------------------------------

function updateCardInStorage(updatedCard) {

  const allCards = getCards();

  const index =
    allCards.findIndex(
      card => card.id === updatedCard.id
    );

  if (index !== -1) {

    allCards[index] = updatedCard;

    saveCards(allCards);
  }
}


// ------------------------------
// 学習データ
// ------------------------------

function getProgress() {

  const savedProgress =
    localStorage.getItem("memorai_progress");

  if (savedProgress) {

    return JSON.parse(savedProgress);
  }

  const progress = {

    totalAnswered: 0,

    correct: 0,

    wrong: 0,

    streak: 0,

    lastStudyDate: null

  };

  saveProgress(progress);

  return progress;
}


function saveProgress(progress) {

  localStorage.setItem(
    "memorai_progress",
    JSON.stringify(progress)
  );
}


// ------------------------------
// 連続日数
// ------------------------------

// 日付を "YYYY-MM-DD"（端末の時刻）にする
function toDateString(date) {

  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, "0");

  const day =
    String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getTodayString() {

  return toDateString(new Date());
}


function getYesterdayString() {

  const yesterday = new Date();

  yesterday.setDate(yesterday.getDate() - 1);

  return toDateString(yesterday);
}


// 回答したときに連続日数を更新する
function updateStreak() {

  const today = getTodayString();


  // 今日すでに学習済みなら何もしない
  if (progress.lastStudyDate === today) {

    return;
  }


  if (progress.lastStudyDate === getYesterdayString()) {

    progress.streak++;

  } else {

    progress.streak = 1;
  }


  progress.lastStudyDate = today;
}


// 表示用の連続日数（今日も昨日も学習していなければ 0）
function getDisplayStreak() {

  if (
    progress.lastStudyDate === getTodayString() ||
    progress.lastStudyDate === getYesterdayString()
  ) {

    return progress.streak;
  }

  return 0;
}


// ------------------------------
// 正答率・復習判定
// ------------------------------

// カードの正答率（0〜1）。未回答なら 0
function getAccuracy(card) {

  const correct =
    card.correct || 0;

  const wrong =
    card.wrong || 0;

  const total =
    correct + wrong;

  return total === 0
    ? 0
    : correct / total;
}


// 今日復習すべきカードか（一度学習して、復習間隔を過ぎたものだけ）
// 未学習のカードは「新しいカード」として別に扱う
function isDue(card) {

  if (!card.lastStudied) {

    return false;
  }


  const daysPassed =
    (Date.now() - card.lastStudied) /
    (1000 * 60 * 60 * 24);


  const accuracy =
    getAccuracy(card);


  let reviewInterval;


  if (accuracy < 0.5) {

    reviewInterval = 1;

  } else if (accuracy < 0.8) {

    reviewInterval = 3;

  } else {

    reviewInterval = 7;
  }


  return daysPassed >= reviewInterval;
}


// ------------------------------
// 科目設定
// ------------------------------

// 1日の新しいカードの上限の選択肢
const dailyNewLimitOptions = [10, 20, 30];


// 設定がまだなければ null
// 形：{ subjects: { "英語": { levels: [...], types: [...] }, "生物": { levels: [...] } }, dailyNewLimit: 20 }
function getSettings() {

  const savedSettings =
    localStorage.getItem("memorai_settings");

  return savedSettings
    ? JSON.parse(savedSettings)
    : null;
}


function saveSettings(settings) {

  localStorage.setItem(
    "memorai_settings",
    JSON.stringify(settings)
  );
}


// 最初のサンプルカード（英単語・科目別カードに置き換わったので対象外にする）
const sampleCardIds =
  new Set(sampleCards.map(card => card.id));


// 選んだ科目・レベル（英語は単語/熟語も）に入るカードか
// 自分で追加したカード（レベルなし）は常に対象にする
function isCardInScope(card, settings) {

  if (sampleCardIds.has(card.id)) {

    return false;
  }


  if (!card.level) {

    return true;
  }


  const subjectSetting =
    settings.subjects[card.subject];

  if (!subjectSetting) {

    return false;
  }


  if (!subjectSetting.levels.includes(card.level)) {

    return false;
  }


  if (card.subject === "英語") {

    return subjectSetting.types.includes(card.type);
  }

  return true;
}


function getScopedCards(allCards) {

  const settings = getSettings();

  return allCards.filter(
    card => isCardInScope(card, settings)
  );
}


// ------------------------------
// 1日の新しいカード
// ------------------------------

// 今日すでに出した新しいカードの枚数（日付が変わったら 0）
function getTodayNewCount() {

  const saved =
    localStorage.getItem("memorai_daily_new");

  if (!saved) {

    return 0;
  }


  const daily = JSON.parse(saved);

  return daily.date === getTodayString()
    ? daily.count
    : 0;
}


function addTodayNewCount() {

  localStorage.setItem(
    "memorai_daily_new",
    JSON.stringify({
      date: getTodayString(),
      count: getTodayNewCount() + 1
    })
  );
}


// 今日あと何枚、新しいカードを出せるか
function getRemainingNewLimit() {

  return Math.max(
    0,
    getSettings().dailyNewLimit - getTodayNewCount()
  );
}


// 未学習カードを出す順に並べる
// 科目ごとにレベル順・id 順に並べ、科目を順番に1枚ずつ混ぜる
// （英語の2600語が終わるまで他の科目が出ない、ということがないように）
function getNewCardQueue(scopedCards) {

  const groups = {};


  scopedCards
    .filter(card => !card.lastStudied)
    .forEach(card => {

      if (!groups[card.subject]) {

        groups[card.subject] = [];
      }

      groups[card.subject].push(card);
    });


  const levelIndex = card =>
    subjectLevels[card.subject]
      ? subjectLevels[card.subject].indexOf(card.level)
      : -1;


  const queues =
    Object.values(groups).map(group =>
      group.sort(
        (a, b) =>
          levelIndex(a) - levelIndex(b) ||
          a.id - b.id
      )
    );


  const ordered = [];

  let index = 0;

  while (queues.some(queue => index < queue.length)) {

    queues.forEach(queue => {

      if (index < queue.length) {

        ordered.push(queue[index]);
      }
    });

    index++;
  }

  return ordered;
}


// ------------------------------
// 現在のデータ
// ------------------------------

let cards = getCards();

let progress = getProgress();

let currentCard = 0;

// レベル別に勉強中なら { level, type }（それ以外は null）
let currentLevelStudy = null;


// ------------------------------
// ホーム
// ------------------------------

function showHome() {

  setActiveNav("homeNavButton");


  // 科目設定がまだなら、先に設定画面を出す
  if (!getSettings()) {

    showSettingsPage(true);

    return;
  }


  // 必ず全カードを読み直す
  cards = getCards();

  progress = getProgress();


  const scopedCards =
    getScopedCards(cards);


  // 今日の復習（学習済みで復習間隔を過ぎたもの）
  const reviewCount =
    scopedCards.filter(isDue).length;


  // 新しいカード（未学習のうち、今日の残り上限まで）
  const newCount =
    Math.min(
      getRemainingNewLimit(),
      scopedCards.filter(card => !card.lastStudied).length
    );


  document.querySelector("main").innerHTML = `

    <section class="welcome">

      <h1>
        今日も勉強しよう。
      </h1>

      <p>
        少しずつでも、毎日続けよう。
      </p>

    </section>


    <section class="study-card">

      <div class="today-counts">

        <div>

          <p>
            今日の復習
          </p>

          <div class="number">
            ${reviewCount}
          </div>

          <p>
            枚
          </p>

        </div>


        <div>

          <p>
            新しいカード
          </p>

          <div class="number">
            ${newCount}
          </div>

          <p>
            枚
          </p>

        </div>

      </div>

      <button
        class="start-button"
        id="startButton"
      >
        勉強を始める
      </button>

    </section>


    <button
      class="level-entry-button"
      id="levelEntryButton"
    >
      📚 科目・レベル別に勉強
    </button>


    <section class="stats">

      <div class="stat">

        <div class="stat-number">
          ${progress.totalAnswered}
        </div>

        <div class="stat-label">
          学習回数
        </div>

      </div>


      <div class="stat">

        <div class="stat-number">

          ${
            progress.totalAnswered === 0
              ? 0
              : Math.round(
                  progress.correct /
                  progress.totalAnswered *
                  100
                )
          }%

        </div>

        <div class="stat-label">
          正答率
        </div>

      </div>


      <div class="stat">

        <div class="stat-number">
          ${getDisplayStreak()}
        </div>

        <div class="stat-label">
          連続日数
        </div>

      </div>

    </section>

  `;


  document
    .querySelector("#startButton")
    .addEventListener(
      "click",
      startStudy
    );


  document
    .querySelector("#levelEntryButton")
    .addEventListener(
      "click",
      showSubjectPage
    );
}


// ------------------------------
// 勉強開始
// ------------------------------

function startStudy() {

  // ★必ず全カードを読み直してから、選んだ科目・レベルに絞る
  const scopedCards =
    getScopedCards(getCards());


  // 復習（苦手なものから）
  const reviewCards =
    scopedCards
      .filter(isDue)
      .sort(
        (a, b) => getAccuracy(a) - getAccuracy(b)
      );


  // 新しいカード（今日の残り上限まで）
  const newCards =
    getNewCardQueue(scopedCards)
      .slice(0, getRemainingNewLimit());


  if (reviewCards.length + newCards.length === 0) {

    alert(
      "今日の復習と新しいカードは終わりました！\n「科目・レベル別に勉強」で続けて勉強できます。"
    );

    return;
  }


  // 復習を先に、そのあと新しいカード
  // 学習用の配列だけを使う（保存は updateCardInStorage で1枚ずつ）
  cards = [...reviewCards, ...newCards];

  currentCard = 0;

  currentLevelStudy = null;

  showStudyScreen();
}


// ------------------------------
// 科目・レベル別
// ------------------------------

// 科目ごとのレベル（英語は4レベル、他は3レベル）
const subjectLevels = {
  "英語": ["中学復習", "高校基礎", "共通テスト", "難関大"],
  "生物": ["基礎", "共通テスト", "難関大"],
  "化学": ["基礎", "共通テスト", "難関大"],
  "地理": ["基礎", "共通テスト", "難関大"],
  "日本史": ["基礎", "共通テスト", "難関大"],
  "世界史": ["基礎", "共通テスト", "難関大"],
  "古文": ["基礎", "共通テスト", "難関大"]
};

const studySubjects = Object.keys(subjectLevels);


// 英語だけ 単語／熟語／両方 を選ぶ
const englishTypes = [
  "単語",
  "熟語",
  "両方"
];


// その科目のレベル付きカード（自分で追加したカードやサンプルは含まない）
function getSubjectLevelCards(allCards, subject) {

  return allCards.filter(
    card =>
      card.subject === subject &&
      subjectLevels[subject].includes(card.level)
  );
}


function getLevelCards(allCards, subject, level, type = "両方") {

  return allCards.filter(
    card =>
      card.subject === subject &&
      card.level === level &&
      (type === "両方" || card.type === type)
  );
}


// 完了画面などに出す名前（例：英語 共通テスト（熟語））
function getLevelStudyLabel({ subject, level, type }) {

  if (subject !== "英語") {

    return `${subject} ${level}`;
  }

  return `${subject} ${level}（${type === "両方" ? "単語＋熟語" : type}）`;
}


// レベル・種類ごとの進み具合カード
function getProgressCardHTML(title, targetCards, dataAttribute, buttonLabel) {

  const learnedCount =
    targetCards.filter(
      card => card.lastStudied
    ).length;


  const weakCount =
    targetCards.filter(
      card => (card.wrong || 0) > 0
    ).length;


  const learnedPercent =
    targetCards.length === 0
      ? 0
      : Math.round(
          learnedCount / targetCards.length * 100
        );


  return `

    <div class="subject-card">

      <div class="subject-header">

        <div class="subject-name">
          ${title}
        </div>

        <div class="subject-accuracy">
          ${learnedPercent}%
        </div>

      </div>


      <div class="subject-bar">

        <div
          class="subject-bar-fill"
          style="width:${learnedPercent}%"
        ></div>

      </div>


      <div class="subject-info">

        <span>
          全${targetCards.length}件
        </span>

        <span>
          学習済み ${learnedCount}件
        </span>

        <span>
          苦手 ${weakCount}件
        </span>

      </div>


      <button
        class="subject-study-button"
        ${dataAttribute}
        ${targetCards.length === 0 ? "disabled" : ""}
      >
        ${buttonLabel}
      </button>

    </div>

  `;
}


// 科目選択画面
function showSubjectPage() {

  // 選んだ科目・レベルのカードだけ
  const allCards = getScopedCards(getCards());

  const settings = getSettings();

  const subjects =
    studySubjects.filter(
      subject => settings.subjects[subject]
    );


  let subjectHTML = "";


  subjects.forEach(
    (subject, index) => {

      subjectHTML += getProgressCardHTML(
        subject,
        getSubjectLevelCards(allCards, subject),
        `data-subject-index="${index}"`,
        "📖 この科目を選ぶ"
      );
    }
  );


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>


    <h1 class="page-title">
      科目・レベル別に勉強
    </h1>


    <div class="subject-list">

      ${subjectHTML}

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      showHome
    );


  document
    .querySelectorAll("[data-subject-index]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const subject =
            subjects[
              Number(button.dataset.subjectIndex)
            ];

          showLevelPage(subject);
        }
      );
    });
}


// レベル選択画面
function showLevelPage(subject) {

  // 選んだ科目・レベルのカードだけ
  const allCards = getScopedCards(getCards());

  const subjectSetting =
    getSettings().subjects[subject];

  const levels =
    subjectLevels[subject].filter(
      level => subjectSetting.levels.includes(level)
    );


  let levelHTML = "";


  levels.forEach(
    (level, index) => {

      levelHTML += getProgressCardHTML(
        level,
        getLevelCards(allCards, subject, level),
        `data-level-index="${index}"`,
        subject === "英語"
          ? "📖 このレベルを選ぶ"
          : "📖 このレベルを勉強"
      );
    }
  );


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>


    <h1 class="page-title">
      ${subject}
    </h1>


    <div class="subject-list">

      ${levelHTML}

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      showSubjectPage
    );


  document
    .querySelectorAll("[data-level-index]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const level =
            levels[
              Number(button.dataset.levelIndex)
            ];

          // 英語で単語・熟語の両方を選んでいるときだけ、選ぶ画面をはさむ
          if (subject === "英語" && subjectSetting.types.length > 1) {

            showTypePage(subject, level);

          } else if (subject === "英語") {

            startLevelStudy(subject, level, subjectSetting.types[0]);

          } else {

            startLevelStudy(subject, level, "両方");
          }
        }
      );
    });
}


// 単語／熟語／両方の選択画面（英語のみ）
function showTypePage(subject, level) {

  const allCards = getScopedCards(getCards());


  let typeHTML = "";


  englishTypes.forEach(
    (type, index) => {

      typeHTML += getProgressCardHTML(
        type === "両方" ? "単語＋熟語" : type,
        getLevelCards(allCards, subject, level, type),
        `data-type-index="${index}"`,
        "📖 これを勉強"
      );
    }
  );


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>


    <h1 class="page-title">
      ${subject} ${level}
    </h1>


    <div class="subject-list">

      ${typeHTML}

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      () => showLevelPage(subject)
    );


  document
    .querySelectorAll("[data-type-index]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const type =
            englishTypes[
              Number(button.dataset.typeIndex)
            ];

          startLevelStudy(subject, level, type);
        }
      );
    });
}


// 出題の優先順位
// 0: 復習時期が来た苦手カード
// 1: 未学習のカード
// 2: それ以外
function getLevelPriority(card) {

  if ((card.wrong || 0) > 0 && isDue(card)) {

    return 0;
  }

  if (!card.lastStudied) {

    return 1;
  }

  return 2;
}


// 選んだ科目・レベル・種類から10枚出題する
function startLevelStudy(subject, level, type) {

  // ★必ず全カードを読み直してから絞る
  const levelCards =
    getLevelCards(getScopedCards(getCards()), subject, level, type);


  levelCards.sort((a, b) => {

    const priorityDiff =
      getLevelPriority(a) - getLevelPriority(b);

    if (priorityDiff !== 0) {

      return priorityDiff;
    }


    // 苦手カードは正答率が低い順
    if (getLevelPriority(a) === 0) {

      return getAccuracy(a) - getAccuracy(b);
    }


    // それ以外は最後に学習したのが古い順（未学習は id 順）
    return (
      (a.lastStudied || 0) - (b.lastStudied || 0) ||
      a.id - b.id
    );
  });


  // 学習用の配列だけを使う（保存は updateCardInStorage で1枚ずつ）
  cards = levelCards.slice(0, 10);

  currentCard = 0;

  currentLevelStudy = { subject, level, type };

  showStudyScreen();
}


// ------------------------------
// 勉強画面
// ------------------------------

function showStudyScreen() {

  if (cards.length === 0) {

    alert("カードがありません！");

    showHome();

    return;
  }


  const card =
    cards[currentCard];


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

      <div>
        ${currentCard + 1} / ${cards.length}
      </div>

    </div>


    <div class="flashcard">

      <div class="subject">
        ${escapeHTML(card.subject)}
      </div>


      <div class="question">
        ${escapeHTML(card.question)}
      </div>


      <div id="answerArea">

        <button id="showAnswerButton">
          答えを見る
        </button>

      </div>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      showHome
    );


  document
    .querySelector("#showAnswerButton")
    .addEventListener(
      "click",
      showAnswer
    );
}


// ------------------------------
// 答えを見る
// ------------------------------

function showAnswer() {

  const card =
    cards[currentCard];


  const answerArea =
    document.querySelector(
      "#answerArea"
    );


  answerArea.innerHTML = `

    <div class="answer">

      <div class="answer-title">
        答え
      </div>

      <div class="answer-text">
        ${escapeHTML(card.answer)}
      </div>

    </div>


    <div class="result-buttons">

      <button id="rememberButton">
        ✓ 覚えた
      </button>

      <button id="notRememberButton">
        × まだ
      </button>

    </div>

  `;


  document
    .querySelector("#rememberButton")
    .addEventListener(
      "click",
      () => nextCard(true)
    );


  document
    .querySelector("#notRememberButton")
    .addEventListener(
      "click",
      () => nextCard(false)
    );
}


// ------------------------------
// 次のカード
// ------------------------------

function nextCard(remembered) {

  const card =
    cards[currentCard];


  if (!card.correct) {

    card.correct = 0;
  }


  if (!card.wrong) {

    card.wrong = 0;
  }


  // 初めて答えたカードなら、今日の新しいカードの枚数に数える
  if (!card.lastStudied) {

    addTodayNewCount();
  }


  card.lastStudied =
    Date.now();


  if (remembered) {

    card.correct++;

    progress.correct++;

  } else {

    card.wrong++;

    progress.wrong++;
  }


  progress.totalAnswered++;

  updateStreak();


  // ★重要
  // cards全体を保存しない
  // 今回答えたカードだけ更新する
  updateCardInStorage(card);

  saveProgress(progress);


  currentCard++;


  if (currentCard >= cards.length) {

    showCompleteScreen();

    return;
  }


  showStudyScreen();
}


// ------------------------------
// 完了画面
// ------------------------------

function showCompleteScreen() {

  document.querySelector("main").innerHTML = `

    <div class="study-card">

      <div style="font-size:50px;">
        🎉
      </div>

      <h1>
        お疲れさま！
      </h1>

      <p>
        今日のカードをすべて確認しました。
      </p>

      <p>
        累計正答率：
        ${
          progress.totalAnswered === 0
            ? 0
            : Math.round(
                progress.correct /
                progress.totalAnswered *
                100
              )
        }%
      </p>

      ${
        currentLevelStudy
          ? `
            <button
              class="start-button"
              id="nextLevelButton"
              style="margin-bottom:12px;"
            >
              ${getLevelStudyLabel(currentLevelStudy)} の次の10枚
            </button>
          `
          : ""
      }

      <button
        class="start-button"
        id="homeButton"
      >
        ホームに戻る
      </button>

    </div>

  `;


  const nextLevelButton =
    document.querySelector("#nextLevelButton");


  if (nextLevelButton) {

    const { subject, level, type } = currentLevelStudy;

    nextLevelButton.addEventListener(
      "click",
      () => startLevelStudy(subject, level, type)
    );
  }


  document
    .querySelector("#homeButton")
    .addEventListener(
      "click",
      showHome
    );
}


// ------------------------------
// カード追加画面
// ------------------------------

function showCardPage() {

  setActiveNav("cardNavButton");

  document.querySelector("main").innerHTML = `

    <h1 class="page-title">
      カードを追加
    </h1>


    <div class="form-card">

      <div class="form-group">

        <label>
          科目
        </label>

        <input
          type="text"
          id="subjectInput"
          placeholder="例：数学"
        >

      </div>


      <div class="form-group">

        <label>
          問題
        </label>

        <textarea
          id="questionInput"
          placeholder="例：三平方の定理を表す式は？"
        ></textarea>

      </div>


      <div class="form-group">

        <label>
          答え
        </label>

        <textarea
          id="answerInput"
          placeholder="例：a² + b² = c²"
        ></textarea>

      </div>


      <button
        class="add-card-button"
        id="addCardButton"
      >
        ＋ カードを追加
      </button>

    </div>

  `;


  document
    .querySelector("#addCardButton")
    .addEventListener(
      "click",
      addCard
    );
}


// ------------------------------
// カード追加
// ------------------------------

function addCard() {

  const subject =
    document
      .querySelector("#subjectInput")
      .value
      .trim();


  const question =
    document
      .querySelector("#questionInput")
      .value
      .trim();


  const answer =
    document
      .querySelector("#answerInput")
      .value
      .trim();


  if (!subject || !question || !answer) {

    alert(
      "科目・問題・答えを全部入力してください！"
    );

    return;
  }


  // ★必ず保存されている全カードを取得
  const allCards = getCards();


  const newCard = {

    id: Date.now(),

    question: question,

    answer: answer,

    subject: subject,

    correct: 0,

    wrong: 0

  };


  allCards.push(newCard);


  saveCards(allCards);


  // 現在のカード一覧も更新
  cards = allCards;


  alert(
    "カードを追加しました！"
  );


  document
    .querySelector("#subjectInput")
    .value = "";


  document
    .querySelector("#questionInput")
    .value = "";


  document
    .querySelector("#answerInput")
    .value = "";
}


// ------------------------------
// 成績画面
// ------------------------------

function showStatsPage() {

  // 科目設定がまだなら、先に設定画面を出す
  if (!getSettings()) {

    showSettingsPage(true);

    return;
  }


  // ★必ず全カードを取得
  cards = getCards();

  // 選んだ科目・レベルのカードだけを対象にする
  const allCards = getScopedCards(cards);

  setActiveNav("statsNavButton");


  const accuracy =
    progress.totalAnswered === 0
      ? 0
      : Math.round(
          progress.correct /
          progress.totalAnswered *
          100
        );


  // ------------------------------
  // 苦手カード
  // ------------------------------

  const weakCards =
    [...allCards]
      .filter(
        card => (card.wrong || 0) > 0
      )
      .sort(
        (a, b) => getAccuracy(a) - getAccuracy(b)
      );


  // ------------------------------
  // 科目一覧
  // ------------------------------

  const subjects =
    [...new Set(
      allCards.map(
        card => card.subject
      )
    )];


  let subjectHTML = "";


  subjects.forEach(
    (subject, index) => {

      // subjectCards.js のグローバル変数と名前が重ならないようにする
      const cardsInSubject =
        allCards.filter(
          card =>
            card.subject === subject
        );


      let correct = 0;

      let wrong = 0;


      cardsInSubject.forEach(card => {

        correct +=
          card.correct || 0;

        wrong +=
          card.wrong || 0;

      });


      const total =
        correct + wrong;


      const subjectAccuracy =
        total === 0
          ? 0
          : Math.round(
              correct / total * 100
            );


      let status = "";


      if (total === 0) {

        status =
          "まだ学習していません";

      } else if (subjectAccuracy < 50) {

        status =
          "⚠️ 要復習";

      } else if (subjectAccuracy < 80) {

        status =
          "📖 もう少し";

      } else {

        status =
          "👍 順調";
      }


      subjectHTML += `

        <div class="subject-card">

          <div class="subject-header">

            <div class="subject-name">
              ${escapeHTML(subject)}
            </div>

            <div class="subject-accuracy">
              ${subjectAccuracy}%
            </div>

          </div>


          <div class="subject-bar">

            <div
              class="subject-bar-fill"
              style="width:${subjectAccuracy}%"
            ></div>

          </div>


          <div class="subject-info">

            <span>
              ${correct}問正解
            </span>

            <span>
              ${wrong}問不正解
            </span>

            <span>
              ${status}
            </span>

          </div>


          <button
            class="subject-study-button"
            data-subject-index="${index}"
          >
            📖 この科目を勉強
          </button>

        </div>

      `;
    }
  );


  // ------------------------------
  // 苦手カード表示
  // ------------------------------

  let weakCardHTML = "";


  if (weakCards.length === 0) {

    weakCardHTML = `

      <div class="no-weak-card">
        まだ苦手カードはありません！
      </div>

    `;

  } else {

    weakCards.forEach(
      (card, index) => {

        const wrong =
          card.wrong || 0;


        const cardAccuracy =
          Math.round(
            getAccuracy(card) * 100
          );


        weakCardHTML += `

          <div class="weak-card">

            <div class="weak-rank">
              ${index + 1}
            </div>


            <div class="weak-content">

              <div class="weak-subject">
                ${escapeHTML(card.subject)}
              </div>

              <div class="weak-question">
                ${escapeHTML(card.question)}
              </div>

              <div class="weak-result">
                正解率 ${cardAccuracy}%
                ／ 不正解 ${wrong}回
              </div>

            </div>

          </div>

        `;
      }
    );
  }


  // ------------------------------
  // 画面表示
  // ------------------------------

  document.querySelector("main").innerHTML = `

    <h1 class="page-title">
      成績
    </h1>


    <button
      class="level-entry-button"
      id="settingsButton"
    >
      ⚙️ 科目設定
    </button>


    <section class="stats">

      <div class="stat">

        <div class="stat-number">
          ${allCards.length}
        </div>

        <div class="stat-label">
          カード枚数
        </div>

      </div>


      <div class="stat">

        <div class="stat-number">
          ${progress.totalAnswered}
        </div>

        <div class="stat-label">
          学習回数
        </div>

      </div>


      <div class="stat">

        <div class="stat-number">
          ${accuracy}%
        </div>

        <div class="stat-label">
          正答率
        </div>

      </div>

    </section>


    <h2 style="margin-top:30px;">
      📚 科目別成績
    </h2>


    <div class="subject-list">

      ${subjectHTML}

    </div>


    <h2 style="margin-top:30px;">
      🔥 苦手カード
    </h2>


    <button
      class="weak-study-button"
      id="weakStudyButton"
      ${weakCards.length === 0 ? "disabled" : ""}
    >
      🔥 苦手カードを勉強する
    </button>


    <div class="weak-card-list">

      ${weakCardHTML}

    </div>

  `;


  document
    .querySelector("#settingsButton")
    .addEventListener(
      "click",
      () => showSettingsPage(false)
    );


  // ------------------------------
  // 科目別勉強
  // ------------------------------

  const subjectButtons =
    document.querySelectorAll(
      ".subject-study-button"
    );


  subjectButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.subjectIndex
            );


          const selectedSubject =
            subjects[index];


          // 学習用にコピー（選んだ科目・レベルのカードだけ）
          cards =
            getScopedCards(getCards())
              .filter(
                card =>
                  card.subject ===
                  selectedSubject
              );


          currentCard = 0;

          currentLevelStudy = null;

          showStudyScreen();

        }
      );
    }
  );


  // ------------------------------
  // 苦手カード勉強
  // ------------------------------

  const weakStudyButton =
    document.querySelector(
      "#weakStudyButton"
    );


  if (weakStudyButton) {

    weakStudyButton.addEventListener(
      "click",
      () => {

        // 学習用のコピー
        cards =
          weakCards.slice();


        currentCard = 0;

        currentLevelStudy = null;

        showStudyScreen();

      }
    );
  }

}


// ------------------------------
// 科目設定画面
// isFirst: 初回起動時（戻るボタンなし、保存後はホームへ）
// ------------------------------

function showSettingsPage(isFirst) {

  const settings = getSettings();


  // 今の設定（初回は、科目は未選択・レベルと種類は全部オン）
  const isSubjectOn = subject =>
    Boolean(settings && settings.subjects[subject]);

  const isLevelOn = (subject, level) =>
    isSubjectOn(subject)
      ? settings.subjects[subject].levels.includes(level)
      : true;

  const isTypeOn = type =>
    isSubjectOn("英語")
      ? settings.subjects["英語"].types.includes(type)
      : true;

  const currentLimit =
    settings ? settings.dailyNewLimit : 20;


  const checked = on => on ? "checked" : "";


  let subjectHTML = "";


  studySubjects.forEach(
    (subject, subjectIndex) => {

      const levelHTML =
        subjectLevels[subject]
          .map(level => `
            <label>
              <input
                type="checkbox"
                data-level-of="${subjectIndex}"
                value="${level}"
                ${checked(isLevelOn(subject, level))}
              >
              ${level}
            </label>
          `)
          .join("");


      const typeHTML =
        subject === "英語"
          ? `
            <div class="settings-row-label">
              種類
            </div>

            <div class="check-row">
              ${["単語", "熟語"].map(type => `
                <label>
                  <input
                    type="checkbox"
                    data-type-of="${subjectIndex}"
                    value="${type}"
                    ${checked(isTypeOn(type))}
                  >
                  ${type}
                </label>
              `).join("")}
            </div>
          `
          : "";


      subjectHTML += `

        <div class="settings-subject">

          <label class="settings-subject-name">
            <input
              type="checkbox"
              data-subject-index="${subjectIndex}"
              ${checked(isSubjectOn(subject))}
            >
            ${subject}
          </label>


          <div
            class="settings-options"
            data-options-for="${subjectIndex}"
            ${isSubjectOn(subject) ? "" : "hidden"}
          >

            <div class="settings-row-label">
              レベル
            </div>

            <div class="check-row">
              ${levelHTML}
            </div>

            ${typeHTML}

          </div>

        </div>

      `;
    }
  );


  const limitHTML =
    dailyNewLimitOptions
      .map(limit => `
        <label>
          <input
            type="radio"
            name="dailyNewLimit"
            value="${limit}"
            ${checked(limit === currentLimit)}
          >
          ${limit}枚
        </label>
      `)
      .join("");


  document.querySelector("main").innerHTML = `

    ${
      isFirst
        ? ""
        : `
          <div class="study-header">

            <button id="backButton">
              ← 戻る
            </button>

          </div>
        `
    }


    <h1 class="page-title">
      科目設定
    </h1>


    ${
      isFirst
        ? `
          <p class="settings-lead">
            勉強する科目とレベルを選んでください。<br>
            あとから成績画面の「科目設定」で変更できます。
          </p>
        `
        : ""
    }


    ${subjectHTML}


    <div class="settings-subject">

      <div class="settings-subject-name">
        1日の新しいカード
      </div>

      <div class="check-row">
        ${limitHTML}
      </div>

    </div>


    <p
      class="settings-error"
      id="settingsError"
      hidden
    ></p>


    <button
      class="start-button"
      id="saveSettingsButton"
    >
      保存する
    </button>

  `;


  // 科目のチェックに合わせてレベル・種類の欄を出し入れする
  document
    .querySelectorAll("[data-subject-index]")
    .forEach(checkbox => {

      checkbox.addEventListener(
        "change",
        () => {

          document
            .querySelector(
              `[data-options-for="${checkbox.dataset.subjectIndex}"]`
            )
            .hidden = !checkbox.checked;
        }
      );
    });


  const backButton =
    document.querySelector("#backButton");

  if (backButton) {

    backButton.addEventListener(
      "click",
      showStatsPage
    );
  }


  document
    .querySelector("#saveSettingsButton")
    .addEventListener(
      "click",
      () => {

        const newSettings = {
          subjects: {},
          dailyNewLimit: Number(
            document.querySelector(
              'input[name="dailyNewLimit"]:checked'
            ).value
          )
        };


        const valuesOf = selector =>
          [...document.querySelectorAll(`${selector}:checked`)]
            .map(input => input.value);


        let error = "";


        studySubjects.forEach(
          (subject, subjectIndex) => {

            const subjectCheckbox =
              document.querySelector(
                `[data-subject-index="${subjectIndex}"]`
              );

            if (!subjectCheckbox.checked) {

              return;
            }


            const levels =
              valuesOf(`[data-level-of="${subjectIndex}"]`);

            if (levels.length === 0 && !error) {

              error = `${subject}のレベルを1つ以上選んでください。`;
            }


            newSettings.subjects[subject] = { levels };


            if (subject === "英語") {

              const types =
                valuesOf(`[data-type-of="${subjectIndex}"]`);

              if (types.length === 0 && !error) {

                error = "英語の単語・熟語を1つ以上選んでください。";
              }

              newSettings.subjects[subject].types = types;
            }
          }
        );


        if (Object.keys(newSettings.subjects).length === 0) {

          error = "科目を1つ以上選んでください。";
        }


        const errorArea =
          document.querySelector("#settingsError");

        if (error) {

          errorArea.textContent = error;

          errorArea.hidden = false;

          return;
        }


        saveSettings(newSettings);


        if (isFirst) {

          showHome();

        } else {

          showStatsPage();
        }
      }
    );
}


// ------------------------------
// ナビゲーション
// ------------------------------

// 指定したボタンだけに active を付ける
function setActiveNav(buttonId) {

  document
    .querySelectorAll(".nav-button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.id === buttonId
      );
    });
}


document
  .querySelector("#homeNavButton")
  .addEventListener(
    "click",
    showHome
  );


document
  .querySelector("#cardNavButton")
  .addEventListener(
    "click",
    showCardPage
  );


document
  .querySelector("#statsNavButton")
  .addEventListener(
    "click",
    showStatsPage
  );


// ------------------------------
// 最初にホームを表示
// ------------------------------
if (getCards().length === 0) {
  saveCards(JSON.parse(JSON.stringify(sampleCards)));
  cards = getCards();
}
showHome();