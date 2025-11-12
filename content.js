// Content script pour sélectionner automatiquement des réponses aléatoires sur GlobalExam

let isProcessing = false;

// Fonction pour trouver tous les choix disponibles (y compris ceux déjà sélectionnés)
function findAllChoices() {
    const choices = [];
    const foundInputs = new Set(); // Pour éviter les doublons

    // Méthode 1: Chercher directement tous les inputs radio/checkbox
    const allInputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    console.log(`🔍 Recherche: ${allInputs.length} input(s) radio/checkbox trouvé(s) dans le DOM`);

    allInputs.forEach((input, index) => {
        if (foundInputs.has(input)) return;

        try {
            // Trouver le label associé
            let label = null;
            let text = '';

            // Essayer de trouver le label via l'attribut "for"
            if (input.id) {
                label = document.querySelector(`label[for="${input.id}"]`);
            }

            // Si pas de label via "for", chercher le parent label
            if (!label) {
                label = input.closest('label');
            }

            // Si toujours pas de label, chercher dans le parent
            if (!label) {
                let parent = input.parentElement;
                // Remonter jusqu'à 3 niveaux pour trouver un label
                for (let i = 0; i < 3 && parent; i++) {
                    if (parent.tagName === 'LABEL') {
                        label = parent;
                        break;
                    }
                    parent = parent.parentElement;
                }
            }

            // Extraire le texte du choix
            if (label) {
                // Essayer plusieurs méthodes pour extraire le texte
                const spans = label.querySelectorAll("span");
                for (const span of spans) {
                    const spanText = span.textContent.trim();
                    if (spanText && spanText.length > 0 && !spanText.match(/^[A-Z]\.\s*$/)) {
                        text = spanText;
                        break;
                    }
                }

                // Si pas de texte dans les spans, prendre tout le texte du label
                if (!text) {
                    text = label.textContent.trim();
                    // Nettoyer le texte (enlever "A.", "B.", "C." au début)
                    text = text.replace(/^[A-Z]\.\s*/, '').trim();
                }
            } else {
                // Pas de label trouvé, chercher le texte dans le parent ou les siblings
                let parent = input.parentElement;
                if (parent) {
                    // Chercher le texte dans le parent
                    text = parent.textContent.trim();
                    text = text.replace(/^[A-Z]\.\s*/, '').trim();

                    // Si le texte est trop court ou vide, chercher dans les siblings
                    if (!text || text.length < 2) {
                        const nextSibling = input.nextElementSibling;
                        if (nextSibling) {
                            text = nextSibling.textContent.trim();
                        }
                    }

                    label = parent;
                }
            }

            // Accepter l'input même si le texte est court ou vide (on utilisera un texte par défaut)
            if (input) {
                if (!text || text.length === 0) {
                    text = `Option ${index + 1}`;
                }

                foundInputs.add(input);
                choices.push({
                    label: label || input.parentElement || input,
                    text: text,
                    input: input,
                    isChecked: input.checked
                });
                console.log(`  ✓ Input ${index + 1}: "${text.substring(0, 50)}" (checked: ${input.checked})`);
            }
        } catch (e) {
            console.log(`  ✗ Erreur input ${index + 1}:`, e);
        }
    });

    // Méthode 2: Chercher les labels avec différentes classes (fallback)
    if (choices.length === 0) {
        console.log("🔍 Méthode 2: Recherche via labels...");
        const labels = document.querySelectorAll("label");
        console.log(`  ${labels.length} label(s) trouvé(s)`);

        labels.forEach((label, index) => {
            try {
                const input = label.querySelector('input[type="radio"], input[type="checkbox"]');
                if (input && !foundInputs.has(input)) {
                    let text = label.textContent.trim().replace(/^[A-Z]\.\s*/, '').trim();
                    if (!text || text.length === 0) {
                        text = `Option ${index + 1}`;
                    }

                    foundInputs.add(input);
                    choices.push({
                        label: label,
                        text: text,
                        input: input,
                        isChecked: input.checked
                    });
                    console.log(`  ✓ Label ${index + 1}: "${text.substring(0, 50)}"`);
                }
            } catch (e) {
                // Ignorer
            }
        });
    }

    console.log(`🔍 Total: ${choices.length} choix(s) trouvé(s)`);
    if (choices.length > 0) {
        choices.forEach((c, i) => {
            console.log(`  ${i + 1}. "${c.text.substring(0, 50)}" (checked: ${c.isChecked})`);
        });
    }
    return choices;
}

// Fonction pour vérifier si une réponse est déjà sélectionnée
function hasAnswerSelected() {
    const choices = findAllChoices();
    return choices.some(choice => choice.isChecked);
}

// Fonction pour grouper les choix par question (par name pour les radio buttons)
function groupChoicesByQuestion(choices) {
    const groups = {};

    choices.forEach(choice => {
        const name = choice.input.name || 'default';
        if (!groups[name]) {
            groups[name] = [];
        }
        groups[name].push(choice);
    });

    return groups;
}

// Fonction pour cliquer sur un choix aléatoire pour chaque question
function clickRandomChoice() {
    const choices = findAllChoices();

    if (choices.length === 0) {
        console.log("🎲 Aucun choix disponible à sélectionner");
        return false;
    }

    // Grouper les choix par question (par name)
    const groups = groupChoicesByQuestion(choices);
    const questionNames = Object.keys(groups);

    console.log(`📋 ${questionNames.length} question(s) trouvée(s)`);

    let clickedCount = 0;

    // Pour chaque question, sélectionner une réponse aléatoire
    questionNames.forEach((name, index) => {
        const questionChoices = groups[name];
        if (questionChoices.length === 0) return;

        // Sélectionner un choix aléatoire pour cette question
        const randomIndex = Math.floor(Math.random() * questionChoices.length);
        const randomChoice = questionChoices[randomIndex];

        console.log(`  Question ${index + 1} (name: ${name}): ${questionChoices.length} choix, sélection: "${randomChoice.text.substring(0, 30)}"`);

        // Cliquer sur ce choix - essayer plusieurs méthodes
        try {
            // Méthode 1: Cliquer sur le label (meilleur si input est hidden)
            if (randomChoice.label) {
                randomChoice.label.click();
                clickedCount++;
            } else {
                // Méthode 2: Cliquer directement sur l'input
                randomChoice.input.click();
                clickedCount++;
            }
        } catch (e1) {
            try {
                // Méthode 3: Forcer la sélection via checked
                randomChoice.input.checked = true;
                randomChoice.input.dispatchEvent(new Event('change', { bubbles: true }));
                clickedCount++;
            } catch (e2) {
                console.log(`  ❌ Erreur pour question ${index + 1}:`, e2);
            }
        }
    });

    if (clickedCount === 0) {
        return false;
    }

    console.log(`✅ ${clickedCount} réponse(s) sélectionnée(s) pour ${questionNames.length} question(s)`);
    return true;
}

// Fonction pour trouver le bouton "Terminer"
function findFinishButton() {
    try {
        const buttons = document.querySelectorAll("button.button-outline-primary-large, button.button-solid-primary-large, button");

        for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes("terminer") || text.includes("finir") || text.includes("finish") || text.includes("compléter")) {
                return btn;
            }
        }

        return null;
    } catch (e) {
        console.log("❌ Erreur lors de la recherche du bouton terminer:", e);
        return null;
    }
}

// Fonction pour cliquer sur le bouton suivant/valider
function clickNextButton() {
    try {
        const buttons = document.querySelectorAll("button.button-outline-primary-large, button.button-solid-primary-large");

        for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes("valider") || text.includes("suivant") || text.includes("passer") || text.includes("continuer")) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    btn.click();
                    console.log(`🟢 Bouton cliqué: ${text}`);
                }, 1000);
                return true;
            }
        }

        return false;
    } catch (e) {
        console.log("❌ Erreur lors du clic sur le bouton:", e);
        return false;
    }
}

// Fonction principale pour traiter la page
function processPage() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;
    console.log("🎲 Début du traitement automatique...");

    // D'abord vérifier s'il y a un bouton "Terminer" - si oui, on est à la fin
    const finishButton = findFinishButton();
    if (finishButton) {
        console.log("🏁 Bouton 'Terminer' détecté - fin du quiz");
        finishButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            try {
                finishButton.click();
                console.log("✅ Quiz terminé - bouton cliqué");
            } catch (e) {
                console.log("❌ Erreur lors du clic sur terminer:", e);
            }
            isProcessing = false;
        }, 1000);
        return;
    }

    // Vérifier s'il y a des choix disponibles
    const choices = findAllChoices();

    if (choices.length === 0) {
        // Pas de choix disponibles - vérifier s'il y a un bouton suivant ou terminer
        console.log("⚠️ Aucun choix disponible");

        // Si une réponse est déjà sélectionnée, essayer de cliquer sur suivant
        if (hasAnswerSelected()) {
            console.log("✅ Une réponse est déjà sélectionnée, passage à la suite...");
            setTimeout(() => {
                clickNextButton();
                isProcessing = false;
            }, 1000);
            return;
        }

        const nextButtonClicked = clickNextButton();
        if (!nextButtonClicked) {
            // Pas de bouton suivant non plus - chercher terminer une dernière fois
            setTimeout(() => {
                const finishBtn = findFinishButton();
                if (finishBtn) {
                    finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        finishBtn.click();
                        console.log("✅ Quiz terminé (bouton trouvé après vérification)");
                    }, 1000);
                } else {
                    console.log("⏸️ En attente de nouvelles questions...");
                }
                isProcessing = false;
            }, 1500);
        } else {
            isProcessing = false;
        }
        return;
    }

    // Vérifier si une réponse est déjà sélectionnée
    const answerSelected = hasAnswerSelected();

    if (answerSelected) {
        // Une réponse est déjà sélectionnée - cliquer directement sur suivant
        console.log("✅ Réponse déjà sélectionnée, passage à la suite...");
        setTimeout(() => {
            const nextClicked = clickNextButton();
            if (!nextClicked) {
                // Pas de bouton suivant - peut-être qu'on doit terminer
                setTimeout(() => {
                    const finishBtn = findFinishButton();
                    if (finishBtn) {
                        finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => {
                            finishBtn.click();
                            console.log("✅ Quiz terminé");
                        }, 1000);
                    }
                }, 1000);
            }
            isProcessing = false;
        }, 1000);
        return;
    }

    // Il y a des choix et aucune réponse sélectionnée - sélectionner une réponse aléatoire
    const choiceClicked = clickRandomChoice();

    if (choiceClicked) {
        // Attendre que le choix soit sélectionné puis cliquer sur suivant
        // Le clickRandomChoice() fait déjà un setTimeout de 500ms + 300ms de vérification
        // Donc on attend un peu plus pour être sûr que c'est fait
        setTimeout(() => {
            // Vérifier que le choix a bien été sélectionné avant de continuer
            const choices = findAllChoices();
            const hasSelected = choices.some(c => c.isChecked);

            if (hasSelected) {
                // Attendre encore un peu puis cliquer sur suivant
                setTimeout(() => {
                    const nextClicked = clickNextButton();
                    if (!nextClicked) {
                        // Pas de bouton suivant - peut-être qu'on doit terminer
                        setTimeout(() => {
                            const finishBtn = findFinishButton();
                            if (finishBtn) {
                                finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => {
                                    finishBtn.click();
                                    console.log("✅ Quiz terminé (après sélection)");
                                }, 1000);
                            }
                        }, 1000);
                    }
                    isProcessing = false;
                }, 1500);
            } else {
                // Le choix n'a pas été sélectionné, réessayer
                console.log("⚠️ Le choix n'a pas été sélectionné, nouvel essai...");
                isProcessing = false;
                setTimeout(() => processPage(), 1000);
            }
        }, 1500);
    } else {
        isProcessing = false;
    }
}

// Observer les changements de la page pour détecter de nouvelles questions
let lastProcessedHash = '';
function getPageHash() {
    // Créer un hash basé sur les questions et choix visibles
    const questions = document.querySelectorAll("p.text-neutral-80.leading-tight.mb-8");
    const choices = document.querySelectorAll("label.flex.items-center.justify-between");
    const buttons = document.querySelectorAll("button.button-outline-primary-large, button.button-solid-primary-large");

    let hash = '';
    questions.forEach(q => hash += q.textContent.substring(0, 50));
    choices.forEach(c => hash += c.textContent.substring(0, 30));
    buttons.forEach(b => hash += b.textContent);

    return hash;
}

const observer = new MutationObserver(() => {
    // Attendre un peu que la page se stabilise
    setTimeout(() => {
        const currentHash = getPageHash();
        // Ne traiter que si la page a vraiment changé
        if (!isProcessing && currentHash !== lastProcessedHash) {
            lastProcessedHash = currentHash;
            processPage();
        }
    }, 2000);
});

// Démarrer l'observation
if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Traiter la page initiale
    setTimeout(() => {
        processPage();
    }, 2000);
} else {
    // Attendre que le body soit chargé
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            setTimeout(() => {
                processPage();
            }, 2000);
        });
    }
}

// Écouter les messages du popup (pour contrôle manuel)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "clickRandom") {
        processPage();
        sendResponse({ success: true });
        return true;
    }
});

