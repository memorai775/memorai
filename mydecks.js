// ==============================
// 自分の単語帳
// 単語帳を作ってカードを入れ、勉強したり「みんなの単語帳」に投稿したりする
// app.js の関数（getCards・saveCards・escapeHTML・sortForStudy など）を使うので、app.js のあとに読み込む
// ==============================
//
// 単語帳：localStorage の memorai_my_decks に保存
//   { id, title, subject, description, createdAt,
//     importedFrom: みんなの単語帳から取り込んだときの元の id（自分の作品ではないので投稿できない）,
//     postedId: みんなの単語帳に投稿したときの id }
//
// カード：今までどおり memorai_cards に保存し、myDeckId でどの単語帳のカードかを表す


// ------------------------------
// 決まりごと（みんなの単語帳に投稿できる長さと合わせる）
// ------------------------------

const MY_DECK_LIMITS = {
  title: 40,
  subject: 20,
  description: 200,
  cardText: 200
};


// ------------------------------
// 単語帳の取得・保存
// ------------------------------

function newMyDeckId() {

  return "my" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


function saveMyDecks(decks) {

  localStorage.setItem(
    "memorai_my_decks",
    JSON.stringify(decks)
  );
}


function getMyDecks() {

  const saved =
    localStorage.getItem("memorai_my_decks");

  const decks =
    saved ? JSON.parse(saved) : [];

  migrateLooseCards(decks);

  return decks;
}


function getMyDeck(myDeckId) {

  return getMyDecks().find(deck => deck.id === myDeckId) || null;
}


function updateMyDeck(updatedDeck) {

  saveMyDecks(
    getMyDecks().map(deck =>
      deck.id === updatedDeck.id ? updatedDeck : deck
    )
  );
}


function getMyDeckCards(myDeckId, allCards = getCards()) {

  return allCards
    .filter(card => card.myDeckId === myDeckId)
    .sort((a, b) => a.id - b.id);
}


// 単語帳の機能ができる前のカード（自分で追加したもの・取り込んだもの）を単語帳にまとめる
//   自分で追加したカード → 科目ごとに「○○（自分のカード）」
//   取り込んだカード     → 元の単語帳ごと
// 学習記録はそのまま。一度まとめたら、次からは何もしない
function migrateLooseCards(decks) {

  const allCards = getCards();

  let changed = false;


  allCards.forEach(card => {

    if (card.level || card.myDeckId || sampleCardIds.has(card.id)) {

      return;
    }


    let deck;

    if (card.deckId) {

      deck = decks.find(d => d.importedFrom === card.deckId);

      if (!deck) {

        deck = {
          id: newMyDeckId(),
          title: String(card.deckTitle || "取り込んだ単語帳").slice(0, MY_DECK_LIMITS.title),
          subject: String(card.subject).slice(0, MY_DECK_LIMITS.subject),
          description: "",
          createdAt: Date.now(),
          importedFrom: card.deckId
        };

        decks.push(deck);
      }

    } else {

      deck = decks.find(d => d.migratedSubject === card.subject);

      if (!deck) {

        deck = {
          id: newMyDeckId(),
          title: `${card.subject}（自分のカード）`.slice(0, MY_DECK_LIMITS.title),
          subject: String(card.subject).slice(0, MY_DECK_LIMITS.subject),
          description: "",
          createdAt: Date.now(),
          migratedSubject: card.subject
        };

        decks.push(deck);
      }
    }


    card.myDeckId = deck.id;

    changed = true;
  });


  if (changed) {

    saveCards(allCards);

    saveMyDecks(decks);
  }
}


// ------------------------------
// 単語帳の一覧
// ------------------------------

function showMyDecksPage() {

  setActiveNav("cardNavButton");


  const allCards = getCards();

  const decks =
    getMyDecks().sort((a, b) => b.createdAt - a.createdAt);


  const deckHTML =
    decks.length === 0
      ? `
        <div class="no-weak-card">
          まだ単語帳がありません。<br>
          「＋ 新しい単語帳を作る」から作ってみよう！
        </div>
      `
      : decks
          .map(deck => {

            const deckCards =
              getMyDeckCards(deck.id, allCards);

            const learnedCount =
              deckCards.filter(card => card.lastStudied).length;

            const badge =
              deck.importedFrom
                ? "📥 取り込み"
                : deck.postedId
                  ? "📤 投稿済み"
                  : "";

            return `
              <div class="subject-card">

                <div class="subject-header">

                  <div class="subject-name">
                    ${escapeHTML(deck.title)}
                  </div>

                  <div class="subject-accuracy">
                    ${deckCards.length}枚
                  </div>

                </div>


                <div class="subject-info">

                  <span>
                    ${escapeHTML(deck.subject)}
                  </span>

                  <span>
                    学習済み ${learnedCount}枚
                  </span>

                  <span>
                    ${badge}
                  </span>

                </div>


                <button
                  class="subject-study-button"
                  data-my-deck-id="${escapeHTML(deck.id)}"
                >
                  📖 開く
                </button>

              </div>
            `;
          })
          .join("");


  document.querySelector("main").innerHTML = `

    <h1 class="page-title">
      単語帳
    </h1>


    <button
      class="start-button"
      id="newMyDeckButton"
      style="margin-bottom:20px;"
    >
      ＋ 新しい単語帳を作る
    </button>


    <div class="subject-list">

      ${deckHTML}

    </div>

  `;


  document
    .querySelector("#newMyDeckButton")
    .addEventListener(
      "click",
      () => showMyDeckEditPage(null)
    );


  document
    .querySelectorAll("[data-my-deck-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => showMyDeckPage(button.dataset.myDeckId)
      );
    });
}


// ------------------------------
// 単語帳を作る・名前や科目を変える
// myDeckId が null なら新しく作る
// ------------------------------

function showMyDeckEditPage(myDeckId) {

  const deck =
    myDeckId ? getMyDeck(myDeckId) : null;


  const subjectOptions =
    studySubjects
      .map(subject => `<option value="${escapeHTML(subject)}"></option>`)
      .join("");


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>


    <h1 class="page-title">
      ${deck ? "単語帳を編集" : "新しい単語帳"}
    </h1>


    <div class="form-card">

      <div class="form-group">

        <label for="myDeckTitleInput">
          単語帳の名前（${MY_DECK_LIMITS.title}文字まで）
        </label>

        <input
          type="text"
          id="myDeckTitleInput"
          maxlength="${MY_DECK_LIMITS.title}"
          value="${deck ? escapeHTML(deck.title) : ""}"
          placeholder="例：鎌倉時代の重要語句"
        >

      </div>


      <div class="form-group">

        <label for="myDeckSubjectInput">
          科目（${MY_DECK_LIMITS.subject}文字まで）
        </label>

        <input
          type="text"
          id="myDeckSubjectInput"
          maxlength="${MY_DECK_LIMITS.subject}"
          list="myDeckSubjectList"
          value="${deck ? escapeHTML(deck.subject) : ""}"
          placeholder="例：日本史"
        >

        <datalist id="myDeckSubjectList">
          ${subjectOptions}
        </datalist>

      </div>


      <div class="form-group">

        <label for="myDeckDescriptionInput">
          説明（任意・${MY_DECK_LIMITS.description}文字まで）
        </label>

        <textarea
          id="myDeckDescriptionInput"
          maxlength="${MY_DECK_LIMITS.description}"
          placeholder="例：教科書の太字の語句を問題にしました。"
        >${deck ? escapeHTML(deck.description) : ""}</textarea>

      </div>


      <p
        class="settings-error"
        id="myDeckError"
        hidden
      ></p>


      <button
        class="add-card-button"
        id="saveMyDeckButton"
      >
        ${deck ? "保存する" : "作成する"}
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      () => deck ? showMyDeckPage(deck.id) : showMyDecksPage()
    );


  document
    .querySelector("#saveMyDeckButton")
    .addEventListener(
      "click",
      () => {

        const title =
          document.querySelector("#myDeckTitleInput").value.trim();

        const subject =
          document.querySelector("#myDeckSubjectInput").value.trim();

        const description =
          document.querySelector("#myDeckDescriptionInput").value.trim();


        const errorArea =
          document.querySelector("#myDeckError");

        if (!title || !subject) {

          errorArea.textContent = "名前と科目を入力してください。";

          errorArea.hidden = false;

          return;
        }


        if (!deck) {

          const decks = getMyDecks();

          const newDeck = {
            id: newMyDeckId(),
            title,
            subject,
            description,
            createdAt: Date.now()
          };

          decks.push(newDeck);

          saveMyDecks(decks);

          showMyDeckPage(newDeck.id);

          return;
        }


        updateMyDeck({ ...deck, title, subject, description });


        // 科目を変えたら、中のカードの科目もそろえる
        if (subject !== deck.subject) {

          const allCards = getCards();

          allCards.forEach(card => {

            if (card.myDeckId === deck.id) {

              card.subject = subject;
            }
          });

          saveCards(allCards);

          cards = allCards;
        }


        showMyDeckPage(deck.id);
      }
    );
}


// ------------------------------
// 単語帳の中身（カードの追加・削除・勉強・投稿）
// ------------------------------

function showMyDeckPage(myDeckId) {

  setActiveNav("cardNavButton");


  const deck =
    getMyDeck(myDeckId);

  if (!deck) {

    showMyDecksPage();

    return;
  }


  const deckCards =
    getMyDeckCards(myDeckId);


  // 投稿まわりのボタン（取り込んだ単語帳は他の人の作品なので投稿できない）
  let postHTML;

  if (deck.importedFrom) {

    postHTML = `
      <p class="community-note">
        みんなの単語帳から取り込んだ単語帳です（他の人の作品なので投稿はできません）。
      </p>
    `;

  } else if (deck.postedId) {

    postHTML = `
      <button
        class="level-entry-button"
        id="openPostedButton"
      >
        ✓ みんなに投稿済み（投稿を見る）
      </button>
    `;

  } else {

    postHTML = `
      <button
        class="level-entry-button"
        id="postMyDeckButton"
        ${deckCards.length === 0 ? "disabled" : ""}
      >
        📤 みんなに投稿する
      </button>
    `;
  }


  const cardListHTML =
    deckCards.length === 0
      ? `
        <div class="no-weak-card">
          まだカードがありません。上から追加してください。
        </div>
      `
      : [...deckCards]
          .reverse()
          .map(card => `
            <div class="weak-card">

              <div class="weak-content">

                <div class="weak-question">
                  ${escapeHTML(card.question)}
                </div>

                <div class="weak-result">
                  ${escapeHTML(card.answer)}
                </div>

              </div>

              <button
                class="text-button danger card-delete-button"
                data-delete-card-id="${card.id}"
              >
                削除
              </button>

            </div>
          `)
          .join("");


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 単語帳一覧
      </button>

    </div>


    <h1 class="page-title">
      ${escapeHTML(deck.title)}
    </h1>


    <p class="community-note">
      ${escapeHTML(deck.subject)}・${deckCards.length}枚
    </p>

    ${
      deck.description
        ? `<p class="deck-description">${escapeHTML(deck.description)}</p>`
        : ""
    }


    <button
      class="start-button"
      id="studyMyDeckButton"
      style="margin-bottom:12px;"
      ${deckCards.length === 0 ? "disabled" : ""}
    >
      ▶ この単語帳で勉強する
    </button>


    ${postHTML}


    <div class="form-card">

      <div class="form-group">

        <label for="questionInput">
          問題
        </label>

        <textarea
          id="questionInput"
          maxlength="${MY_DECK_LIMITS.cardText}"
          placeholder="例：鎌倉幕府を開いた人物は？"
        ></textarea>

      </div>


      <div class="form-group">

        <label for="answerInput">
          答え
        </label>

        <textarea
          id="answerInput"
          maxlength="${MY_DECK_LIMITS.cardText}"
          placeholder="例：源頼朝"
        ></textarea>

      </div>


      <p
        class="settings-error"
        id="addCardError"
        hidden
      ></p>


      <button
        class="add-card-button"
        id="addCardButton"
      >
        ＋ カードを追加
      </button>

    </div>


    <h2 style="margin-top:30px;">
      カード一覧（${deckCards.length}枚）
    </h2>


    <div class="weak-card-list">

      ${cardListHTML}

    </div>


    <div class="deck-actions">

      <button class="text-button" id="editMyDeckButton">
        ✏️ 名前・科目を変える
      </button>

      <br><br>

      <button class="text-button danger" id="deleteMyDeckButton">
        🗑 この単語帳を削除する
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", showMyDecksPage);


  document
    .querySelector("#studyMyDeckButton")
    .addEventListener("click", () => startMyDeckStudy(myDeckId));


  document
    .querySelector("#addCardButton")
    .addEventListener("click", () => addCardToMyDeck(myDeckId));


  document
    .querySelector("#editMyDeckButton")
    .addEventListener("click", () => showMyDeckEditPage(myDeckId));


  document
    .querySelector("#deleteMyDeckButton")
    .addEventListener("click", () => showDeleteMyDeckPage(myDeckId));


  const postButton =
    document.querySelector("#postMyDeckButton");

  if (postButton) {

    // ログイン画面がブロックされないよう、押した瞬間に投稿画面（ログイン）へ進む
    postButton.addEventListener("click", () => showPostDeckPage(myDeckId));
  }


  const openPostedButton =
    document.querySelector("#openPostedButton");

  if (openPostedButton) {

    openPostedButton.addEventListener(
      "click",
      () => {

        setActiveNav("communityNavButton");

        showDeckDetailPage(deck.postedId);
      }
    );
  }


  // 削除は2回押し（1回目で「本当に削除」に変わる）
  document
    .querySelectorAll("[data-delete-card-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          if (!button.dataset.confirm) {

            button.dataset.confirm = "1";

            button.textContent = "本当に削除";

            return;
          }

          deleteCardFromStorage(Number(button.dataset.deleteCardId));

          showMyDeckPage(myDeckId);
        }
      );
    });
}


function addCardToMyDeck(myDeckId) {

  const deck =
    getMyDeck(myDeckId);

  const question =
    document.querySelector("#questionInput").value.trim();

  const answer =
    document.querySelector("#answerInput").value.trim();


  if (!question || !answer) {

    const errorArea =
      document.querySelector("#addCardError");

    errorArea.textContent = "問題と答えを入力してください。";

    errorArea.hidden = false;

    return;
  }


  // ★必ず保存されている全カードを取得してから追加する
  const allCards = getCards();

  allCards.push({
    id: Date.now(),
    question: question.slice(0, MY_DECK_LIMITS.cardText),
    answer: answer.slice(0, MY_DECK_LIMITS.cardText),
    subject: deck.subject,
    myDeckId: myDeckId,
    correct: 0,
    wrong: 0
  });

  saveCards(allCards);

  cards = allCards;


  // 続けて入力しやすいように、問題の欄にカーソルを戻す
  showMyDeckPage(myDeckId);

  document.querySelector("#questionInput").focus();
}


function deleteCardFromStorage(cardId) {

  const allCards =
    getCards().filter(card => card.id !== cardId);

  saveCards(allCards);

  cards = allCards;
}


// ------------------------------
// 単語帳を削除
// ------------------------------

function showDeleteMyDeckPage(myDeckId) {

  const deck =
    getMyDeck(myDeckId);

  const count =
    getMyDeckCards(myDeckId).length;


  document.querySelector("main").innerHTML = `

    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>


    <h1 class="page-title">
      単語帳を削除する
    </h1>


    <div class="form-card">

      <p class="community-note">
        「${escapeHTML(deck.title)}」と、中のカード${count}枚・学習記録を削除します。元には戻せません。
        ${
          deck.postedId
            ? "<br>みんなの単語帳に投稿した分は残ります。消したいときは、先に「投稿を見る」から削除してください。"
            : ""
        }
      </p>


      <button
        class="add-card-button danger-button"
        id="confirmDeleteMyDeckButton"
      >
        削除する
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", () => showMyDeckPage(myDeckId));


  document
    .querySelector("#confirmDeleteMyDeckButton")
    .addEventListener(
      "click",
      () => {

        const allCards =
          getCards().filter(card => card.myDeckId !== myDeckId);

        saveCards(allCards);

        cards = allCards;

        saveMyDecks(
          getMyDecks().filter(d => d.id !== myDeckId)
        );

        showMyDecksPage();
      }
    );
}


// ------------------------------
// 単語帳で勉強（10枚ずつ・苦手と未学習を優先）
// ------------------------------

function startMyDeckStudy(myDeckId) {

  // ★必ず全カードを読み直してから絞る
  const deckCards =
    sortForStudy(getMyDeckCards(myDeckId));


  if (deckCards.length === 0) {

    alert("この単語帳にはまだカードがありません。");

    return;
  }


  // 学習用の配列だけを使う（保存は updateCardInStorage で1枚ずつ）
  cards = deckCards.slice(0, 10);

  currentCard = 0;

  currentLevelStudy = { myDeckId };

  showStudyScreen();
}
