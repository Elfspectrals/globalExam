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
    console.log("🔍 [DEBUG] clickRandomChoice: début de la sélection");

    let clickedCount = 0;
    let skippedCount = 0;

    // Pour chaque question, sélectionner une réponse aléatoire
    questionNames.forEach((name, index) => {
        const questionChoices = groups[name];
        if (questionChoices.length === 0) {
            console.log(`🔍 [DEBUG] Question ${index + 1} (${name}): aucun choix disponible`);
            return;
        }

        // Vérifier si cette question a déjà une réponse
        const hasAnswer = questionChoices.some(c => c.isChecked);
        if (hasAnswer) {
            const selectedChoice = questionChoices.find(c => c.isChecked);
            console.log(`🔍 [DEBUG] Question ${index + 1} (${name}): déjà répondue avec "${selectedChoice?.text?.substring(0, 30)}" - ignorée`);
            skippedCount++;
            return; // Ne pas changer la réponse si elle est déjà sélectionnée
        }

        // Sélectionner un choix aléatoire pour cette question
        const randomIndex = Math.floor(Math.random() * questionChoices.length);
        const randomChoice = questionChoices[randomIndex];

        console.log(`  Question ${index + 1} (name: ${name}): ${questionChoices.length} choix, sélection: "${randomChoice.text.substring(0, 30)}"`);
        console.log(`🔍 [DEBUG] Tentative de sélection pour question ${index + 1}...`);

        // Cliquer sur ce choix - essayer plusieurs méthodes
        try {
            // Méthode 1: Cliquer sur le label (meilleur si input est hidden)
            if (randomChoice.label) {
                randomChoice.label.click();
                console.log(`🔍 [DEBUG] Question ${index + 1}: clic sur label réussi`);
                clickedCount++;
            } else {
                // Méthode 2: Cliquer directement sur l'input
                randomChoice.input.click();
                console.log(`🔍 [DEBUG] Question ${index + 1}: clic sur input réussi`);
                clickedCount++;
            }
        } catch (e1) {
            try {
                // Méthode 3: Forcer la sélection via checked
                randomChoice.input.checked = true;
                randomChoice.input.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`🔍 [DEBUG] Question ${index + 1}: sélection forcée via checked`);
                clickedCount++;
            } catch (e2) {
                console.log(`  ❌ Erreur pour question ${index + 1}:`, e2);
            }
        }
    });

    console.log(`🔍 [DEBUG] clickRandomChoice: ${clickedCount} sélectionnée(s), ${skippedCount} ignorée(s) (déjà répondues)`);

    if (clickedCount === 0) {
        console.log("🔍 [DEBUG] clickRandomChoice: aucune nouvelle sélection effectuée");
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

// Fonction helper pour effectuer le clic sur un bouton avec plusieurs méthodes
async function performButtonClick(btn, text) {
    console.log(`🔬 [DEBUG] performButtonClick appelé pour "${text}"`);
    console.log(`🔬 [DEBUG] État du bouton avant clic:`, {
        disabled: btn.disabled,
        offsetParent: btn.offsetParent,
        display: window.getComputedStyle(btn).display,
        visibility: window.getComputedStyle(btn).visibility,
        pointerEvents: window.getComputedStyle(btn).pointerEvents,
        isConnected: btn.isConnected,
        parentElement: btn.parentElement ? btn.parentElement.tagName : null
    });
    
    // Ajouter un listener temporaire pour voir si le click est reçu
    const clickListener = (e) => {
        console.log(`🔬 [DEBUG] ✅ Événement click reçu sur le bouton "${text}"!`, e);
        console.log(`🔬 [DEBUG] Détails de l'événement:`, {
            type: e.type,
            target: e.target,
            currentTarget: e.currentTarget,
            defaultPrevented: e.defaultPrevented,
            bubbles: e.bubbles,
            cancelable: e.cancelable
        });
    };
    
    const mouseDownListener = (e) => {
        console.log(`🔬 [DEBUG] ✅ Événement mousedown reçu sur le bouton "${text}"!`);
    };
    
    // Ajouter des listeners pour capturer TOUS les événements
    const allEventTypes = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    allEventTypes.forEach(eventType => {
        btn.addEventListener(eventType, (e) => {
            console.log(`🔬 [DEBUG] ✅ Événement ${eventType} reçu! isTrusted: ${e.isTrusted}, defaultPrevented: ${e.defaultPrevented}`);
        }, { once: true, capture: true });
    });
    
    btn.addEventListener('click', clickListener, { once: true, capture: true });
    btn.addEventListener('mousedown', mouseDownListener, { once: true, capture: true });
    
    try {
        // Méthode 1: Focus puis clic - essayer plusieurs fois
        console.log(`🔬 [DEBUG] Tentative Méthode 1: focus() + click()`);
        btn.focus();
        const beforeClick = Date.now();
        
        // Essayer de cliquer plusieurs fois rapidement
        for (let i = 0; i < 10; i++) {
            try {
                btn.click();
            } catch (e) {
                console.log(`🔬 [DEBUG] Erreur click() tentative ${i+1}:`, e);
            }
        }
        
        const afterClick = Date.now();
        console.log(`🟢 Méthode 1: focus() + 10x click() appelés sur "${text}" (${afterClick - beforeClick}ms)`);
        console.log(`🔬 [DEBUG] État après click(): disabled=${btn.disabled}, isConnected=${btn.isConnected}`);
        
        // Méthode 2: Dispatcher des événements de souris (plus robuste)
        setTimeout(() => {
            try {
                console.log(`🔬 [DEBUG] Tentative Méthode 2: événements MouseEvent`);
                const focusEvent = new FocusEvent('focus', { bubbles: true });
                const mouseDownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                });
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 0
                });
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 0
                });
                
                const dispatched = [];
                if (btn.dispatchEvent(focusEvent)) dispatched.push('focus');
                if (btn.dispatchEvent(mouseDownEvent)) dispatched.push('mousedown');
                if (btn.dispatchEvent(mouseUpEvent)) dispatched.push('mouseup');
                const clickResult = btn.dispatchEvent(clickEvent);
                if (clickResult) dispatched.push('click');
                
                console.log(`🟢 Méthode 2: événements dispatchés sur "${text}" - résultats:`, dispatched);
                console.log(`🔬 [DEBUG] clickEvent.defaultPrevented: ${clickEvent.defaultPrevented}`);
            } catch (e2) {
                console.log(`⚠️ Erreur méthode 2:`, e2);
            }
        }, 200);
        
        // Méthode 3: Si c'est un bouton dans un formulaire, essayer de soumettre
        setTimeout(() => {
            try {
                const form = btn.closest('form');
                if (form) {
                    console.log(`🔬 [DEBUG] Tentative Méthode 3: form.requestSubmit()`);
                    form.requestSubmit(btn);
                    console.log(`🟢 Méthode 3: form.requestSubmit() appelé sur "${text}"`);
                } else {
                    console.log(`🔬 [DEBUG] Pas de formulaire parent trouvé`);
                }
            } catch (e3) {
                console.log(`⚠️ Erreur méthode 3:`, e3);
            }
        }, 400);
        
        // Méthode 4: Essayer de déclencher l'événement via le gestionnaire d'événements
        setTimeout(() => {
            try {
                console.log(`🔬 [DEBUG] Tentative Méthode 4: onclick handler`);
                // Chercher si le bouton a un gestionnaire onclick ou un data-* handler
                if (btn.onclick) {
                    console.log(`🔬 [DEBUG] onclick handler trouvé, appel direct`);
                    btn.onclick();
                    console.log(`🟢 Méthode 4: onclick() appelé directement sur "${text}"`);
                } else {
                    console.log(`🔬 [DEBUG] Pas de onclick handler direct`);
                }
            } catch (e4) {
                console.log(`⚠️ Erreur méthode 4:`, e4);
            }
        }, 600);
        
        // Vérifier après un délai si quelque chose a changé
        setTimeout(() => {
            console.log(`🔬 [DEBUG] État du bouton 1s après clic:`, {
                disabled: btn.disabled,
                isConnected: btn.isConnected,
                stillExists: document.contains(btn)
            });
        }, 1000);
        
    } catch (e) {
        console.log(`❌ Erreur dans performButtonClick:`, e);
        console.log(`🔬 [DEBUG] Stack trace:`, e.stack);
    }
}

// Fonction pour cliquer sur le bouton suivant/valider
function clickNextButton() {
    console.log("🔍 [DEBUG] clickNextButton() appelé");
    try {
        // Chercher plus largement - tous les boutons, pas seulement ceux avec des classes spécifiques
        const buttons = document.querySelectorAll("button");
        console.log("🔍 [DEBUG] Nombre total de boutons trouvés:", buttons.length);
        
        // Prioriser "valider" car il fonctionne mieux avec les clics programmatiques
        const buttonPriority = ["valider", "suivant", "continuer", "passer"];
        let foundButtons = [];

        for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase();
            if (text.includes("valider") || text.includes("suivant") || text.includes("passer") || text.includes("continuer")) {
                // Trouver la priorité de ce bouton
                let priority = buttonPriority.length;
                for (let i = 0; i < buttonPriority.length; i++) {
                    if (text.includes(buttonPriority[i])) {
                        priority = i;
                        break;
                    }
                }
                foundButtons.push({ btn, text, priority });
                console.log(`🔍 [DEBUG] Bouton trouvé: "${text}" (priorité: ${priority})`);
            }
        }
        
        console.log("🔍 [DEBUG] Nombre de boutons pertinents trouvés:", foundButtons.length);
        
        // Trier par priorité (valider en premier)
        foundButtons.sort((a, b) => a.priority - b.priority);
        console.log("🔍 [DEBUG] Boutons triés par priorité:", foundButtons.map(b => `"${b.text}" (${b.priority})`));
        
        // Essayer chaque bouton dans l'ordre de priorité
        for (const { btn, text } of foundButtons) {
            console.log(`🔍 [DEBUG] Essai du bouton: "${text}"`);
            // Vérifier si le bouton est visible et non désactivé
            if (btn.disabled || btn.style.display === 'none' || btn.offsetParent === null) {
                console.log(`⚠️ Bouton "${text}" trouvé mais désactivé ou invisible`);
                continue;
            }

            console.log(`🔍 Bouton trouvé: "${text}" - tentative de clic...`);
            console.log(`   - Disabled: ${btn.disabled}`);
            console.log(`   - Type: ${btn.type}`);
            console.log(`   - Classes: ${btn.className}`);
            console.log(`   - ID: ${btn.id || 'aucun'}`);
            console.log(`   - OffsetParent: ${btn.offsetParent ? 'existe' : 'null'}`);
            console.log(`   - Display: ${window.getComputedStyle(btn).display}`);
            console.log(`   - Visibility: ${window.getComputedStyle(btn).visibility}`);
            console.log(`   - PointerEvents: ${window.getComputedStyle(btn).pointerEvents}`);
            console.log(`   - IsConnected: ${btn.isConnected}`);
            
            // Vérifier s'il y a des event listeners (si getEventListeners est disponible)
            try {
                if (typeof getEventListeners === 'function') {
                    const listeners = getEventListeners(btn);
                    console.log(`🔬 [DEBUG] Event listeners sur le bouton:`, listeners);
                }
            } catch (e) {
                console.log(`🔬 [DEBUG] getEventListeners non disponible`);
            }
            
            // Faire défiler jusqu'au bouton (instantané pour ne pas retarder le clic)
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            
            // Essayer de trouver et appeler directement le handler du bouton
            try {
                // Chercher les attributs data-* qui pourraient contenir des handlers
                const dataAttrs = Array.from(btn.attributes).filter(a => a.name.startsWith('data-'));
                console.log(`🔬 [DEBUG] Attributs data-*:`, dataAttrs.map(a => `${a.name}="${a.value}"`));
                
                // Chercher dans le parent pour des handlers
                let parent = btn.parentElement;
                let level = 0;
                while (parent && level < 3) {
                    if (parent.onclick || parent.getAttribute('@click') || parent.getAttribute('v-on:click')) {
                        console.log(`🔬 [DEBUG] Handler trouvé sur parent niveau ${level}:`, parent.tagName);
                    }
                    parent = parent.parentElement;
                    level++;
                }
            } catch (e) {
                console.log(`🔬 [DEBUG] Erreur recherche handlers:`, e);
            }
            
            // Essayer de cliquer immédiatement, puis avec un délai aussi
            try {
                // Clic immédiat
                if (!btn.disabled) {
                    console.log(`🔬 [DEBUG] Tentative de clic immédiat...`);
                    btn.focus();
                    
                    // Essayer de simuler un clic utilisateur en utilisant les coordonnées
                    const rect = btn.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    
                    // Forcer plusieurs clics rapidement
                    for (let i = 0; i < 10; i++) {
                        try {
                            btn.click();
                        } catch (e) {
                            console.log(`🔬 [DEBUG] Erreur click() ${i+1}:`, e);
                        }
                    }
                    console.log(`🔬 [DEBUG] 10x btn.click() appelés`);
                    
                    // Méthode 2: dispatchEvent avec MouseEvent plusieurs fois
                    setTimeout(() => {
                        for (let i = 0; i < 5; i++) {
                            try {
                                const syntheticClick = new MouseEvent('click', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true,
                                    clientX: x,
                                    clientY: y,
                                    button: 0,
                                    buttons: 0
                                });
                                btn.dispatchEvent(syntheticClick);
                            } catch (e) {}
                        }
                        console.log(`🔬 [DEBUG] 5x dispatchEvent(MouseEvent) effectués`);
                    }, 50);
                    
                    // Méthode 3: Cliquer sur le label ou parent si disponible
                    setTimeout(() => {
                        try {
                            // Chercher un élément parent cliquable
                            let clickableParent = btn.parentElement;
                            if (clickableParent && clickableParent.onclick) {
                                clickableParent.click();
                                console.log(`🔬 [DEBUG] Clic sur parent avec onclick`);
                            }
                        } catch (e) {}
                    }, 100);
                    
                    // Méthode 4: Forcer le clic plusieurs fois encore
                    setTimeout(() => {
                        try {
                            for (let i = 0; i < 10; i++) {
                                btn.click();
                            }
                            console.log(`🔬 [DEBUG] 10x clics supplémentaires effectués`);
                        } catch (e) {}
                    }, 200);
                    
                    console.log(`🟢 Clic immédiat effectué sur "${text}"`);
                    console.log(`🔬 [DEBUG] État immédiatement après click(): disabled=${btn.disabled}`);
                } else {
                    console.log(`⚠️ Bouton désactivé, impossible de cliquer immédiatement`);
                }
            } catch (e) {
                console.log(`⚠️ Erreur clic immédiat:`, e);
                console.log(`🔬 [DEBUG] Stack trace:`, e.stack);
            }
            
            // Attendre un peu puis essayer plusieurs méthodes de clic (pour être sûr)
            setTimeout(() => {
                try {
                    // Vérifier à nouveau que le bouton est toujours disponible
                    if (btn.disabled) {
                        console.log(`⚠️ Bouton "${text}" est désactivé, attente...`);
                        // Réessayer après un délai
                        setTimeout(() => {
                            // Re-chercher le bouton au cas où le DOM a changé
                            const currentBtn = Array.from(document.querySelectorAll("button")).find(b => {
                                const btnText = b.textContent.trim().toLowerCase();
                                return btnText.includes("passer") || btnText.includes("valider") || btnText.includes("suivant");
                            });
                            
                            if (currentBtn && !currentBtn.disabled) {
                                performButtonClick(currentBtn, currentBtn.textContent.trim().toLowerCase());
                            } else if (btn && !btn.disabled) {
                                performButtonClick(btn, text);
                            } else {
                                console.log(`❌ Bouton "${text}" toujours désactivé`);
                            }
                        }, 1000);
                        return;
                    }
                    
                    // Utiliser les méthodes avancées en plus du clic immédiat
                    performButtonClick(btn, text);
                    
                } catch (e1) {
                    console.log(`❌ Erreur lors du clic:`, e1);
                }
            }, 300);
            
            return true;
        }

        console.log("⚠️ Aucun bouton 'valider/suivant/passer' trouvé ou tous désactivés");
        return false;
    } catch (e) {
        console.log("❌ Erreur lors du clic sur le bouton:", e);
        return false;
    }
}

// Fonction principale pour traiter la page
function processPage() {
    console.log("🔍 [DEBUG] processPage() appelé - isProcessing:", isProcessing);
    
    if (isProcessing) {
        console.log("⏸️ [DEBUG] processPage() ignoré car isProcessing=true");
        return;
    }

    isProcessing = true;
    console.log("🎲 Début du traitement automatique...");
    console.log("🔍 [DEBUG] isProcessing mis à true");

    // D'abord vérifier s'il y a un bouton "Terminer" - si oui, on est à la fin
    console.log("🔍 [DEBUG] Recherche du bouton 'Terminer'...");
    const finishButton = findFinishButton();
    if (finishButton) {
        console.log("🏁 Bouton 'Terminer' détecté - fin du quiz");
        finishButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            try {
                finishButton.click();
                console.log("✅ Quiz terminé - bouton cliqué");
                console.log("🔍 [DEBUG] isProcessing mis à false (fin du quiz)");
            } catch (e) {
                console.log("❌ Erreur lors du clic sur terminer:", e);
            }
            isProcessing = false;
        }, 1000);
        return;
    } else {
        console.log("🔍 [DEBUG] Aucun bouton 'Terminer' trouvé");
    }

    // Vérifier s'il y a des choix disponibles
    console.log("🔍 [DEBUG] Recherche des choix disponibles...");
    const choices = findAllChoices();
    console.log("🔍 [DEBUG] Nombre de choix trouvés:", choices.length);

    if (choices.length === 0) {
        // Pas de choix disponibles - vérifier s'il y a un bouton suivant ou terminer
        console.log("⚠️ Aucun choix disponible");
        console.log("🔍 [DEBUG] Aucun choix - vérification des réponses sélectionnées...");

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
    console.log("🔍 [DEBUG] Vérification si une réponse est déjà sélectionnée...");
    const answerSelected = hasAnswerSelected();
    console.log("🔍 [DEBUG] Réponse sélectionnée:", answerSelected);
    
    // Vérifier aussi si TOUTES les questions ont une réponse
    const groups = groupChoicesByQuestion(choices);
    const questionNames = Object.keys(groups);
    const allQuestionsAnswered = questionNames.length > 0 && questionNames.every(name => {
        const questionChoices = groups[name];
        return questionChoices.some(c => c.isChecked);
    });
    console.log("🔍 [DEBUG] Toutes les questions répondues:", allQuestionsAnswered, "Nombre de questions:", questionNames.length);

    // Ne cliquer sur le bouton que si TOUTES les questions ont une réponse
    console.log("🔍 [DEBUG] Décision: answerSelected=", answerSelected, "allQuestionsAnswered=", allQuestionsAnswered);
    
    if (answerSelected && allQuestionsAnswered) {
        // Une réponse est déjà sélectionnée ET toutes les questions sont répondues - cliquer directement sur suivant
        console.log("✅ Toutes les questions sont répondues, passage à la suite...");
        console.log("🔍 [DEBUG] Recherche du bouton pour passer à la suite...");
        
        // Vérifier immédiatement si le bouton est disponible
        const buttons = document.querySelectorAll("button");
        let foundButton = null;
        for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase();
            if ((text.includes("valider") || text.includes("suivant") || text.includes("passer") || text.includes("continuer")) 
                && !btn.disabled && btn.offsetParent !== null) {
                foundButton = btn;
                console.log(`🔍 Bouton "${text}" trouvé et disponible`);
                break;
            }
        }
        
        if (foundButton) {
            // Cliquer immédiatement - ne pas attendre
            console.log("🔍 [DEBUG] Clic immédiat sur le bouton trouvé...");
            try {
                foundButton.focus();
                // Forcer plusieurs clics
                for (let i = 0; i < 5; i++) {
                    foundButton.click();
                }
                console.log("🟢 5x clics directs effectués");
                lastClickTime = Date.now(); // Enregistrer immédiatement
            } catch (e) {
                console.log("❌ Erreur clic direct:", e);
            }
            
            // Aussi utiliser clickNextButton pour les méthodes avancées
            setTimeout(() => {
                const nextClicked = clickNextButton();
                if (!nextClicked) {
                    console.log("⚠️ clickNextButton a échoué, mais clic direct déjà effectué");
                }
            }, 200);
            
            // Réinitialiser isProcessing après un délai plus long pour laisser la page se charger
            setTimeout(() => {
                console.log("🔄 Réinitialisation de isProcessing après clic sur bouton");
                console.log("🔍 [DEBUG] isProcessing mis à false - la page devrait être chargée");
                isProcessing = false;
            }, 3000); // Augmenter à 3 secondes pour laisser la page se charger
        } else {
            // Pas de bouton trouvé - peut-être qu'on doit terminer
            console.log("⚠️ Aucun bouton disponible trouvé");
            setTimeout(() => {
                const finishBtn = findFinishButton();
                if (finishBtn) {
                    finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        finishBtn.click();
                        console.log("✅ Quiz terminé");
                        isProcessing = false;
                    }, 1000);
                } else {
                    isProcessing = false;
                }
            }, 1000);
        }
        return;
    }
    
    // Si certaines questions n'ont pas de réponse, on doit sélectionner des réponses
    if (answerSelected && !allQuestionsAnswered) {
        console.log("⚠️ Certaines questions n'ont pas de réponse - sélection de réponses manquantes...");
        console.log("🔍 [DEBUG] Sélection des réponses pour les questions non répondues...");
        // Continuer pour sélectionner les réponses manquantes
    }

    // Il y a des choix et aucune réponse sélectionnée (ou certaines manquantes) - sélectionner une réponse aléatoire
    console.log("🔍 [DEBUG] Aucune réponse sélectionnée - sélection d'une réponse aléatoire...");
    console.log("🔍 [DEBUG] Nombre de choix disponibles:", choices.length);
    const groupsBefore = groupChoicesByQuestion(choices);
    const questionNamesBefore = Object.keys(groupsBefore);
    console.log("🔍 [DEBUG] Nombre de questions avant sélection:", questionNamesBefore.length);
    questionNamesBefore.forEach((name, idx) => {
        const qChoices = groupsBefore[name];
        const hasAnswer = qChoices.some(c => c.isChecked);
        console.log(`🔍 [DEBUG] Question ${idx + 1} (${name}): ${hasAnswer ? 'déjà répondue' : 'non répondue'} - ${qChoices.length} choix`);
    });
    
    const choiceClicked = clickRandomChoice();
    console.log("🔍 [DEBUG] clickRandomChoice() retourné:", choiceClicked);
    
    // Vérifier après la sélection
    if (choiceClicked) {
        setTimeout(() => {
            const choicesAfter = findAllChoices();
            const groupsAfter = groupChoicesByQuestion(choicesAfter);
            const questionNamesAfter = Object.keys(groupsAfter);
            console.log("🔍 [DEBUG] État après sélection - Nombre de questions:", questionNamesAfter.length);
            questionNamesAfter.forEach((name, idx) => {
                const qChoices = groupsAfter[name];
                const hasAnswer = qChoices.some(c => c.isChecked);
                const selectedChoice = qChoices.find(c => c.isChecked);
                console.log(`🔍 [DEBUG] Question ${idx + 1} (${name}): ${hasAnswer ? 'répondue' : 'NON RÉPONDUE'} - ${hasAnswer ? `choix: "${selectedChoice?.text?.substring(0, 30)}"` : 'AUCUN CHOIX'}`);
            });
        }, 500);
    }

    if (choiceClicked) {
        // Attendre que le choix soit sélectionné puis cliquer sur suivant
        // Attendre suffisamment pour que l'UI se mette à jour
        console.log("🔍 [DEBUG] Attente 1 seconde pour que la sélection soit enregistrée...");
        setTimeout(() => {
            // Vérifier que le choix a bien été sélectionné avant de continuer
            console.log("🔍 [DEBUG] Vérification que la réponse a été sélectionnée...");
            const choices = findAllChoices();
            const hasSelected = choices.some(c => c.isChecked);
            console.log("🔍 [DEBUG] Réponse sélectionnée:", hasSelected);

            if (hasSelected) {
                console.log("✅ Réponse sélectionnée, attente avant de cliquer sur le bouton...");
                console.log("🔍 [DEBUG] Attente 2.5 secondes avant de cliquer sur le bouton...");
                // Attendre un peu pour que l'UI se stabilise et que le bouton soit activé
                setTimeout(() => {
                    console.log("🔍 [DEBUG] Tentative de clic sur le bouton suivant...");
                    const nextClicked = clickNextButton();
                    console.log("🔍 [DEBUG] clickNextButton() retourné:", nextClicked);
                    if (!nextClicked) {
                        console.log("🔍 [DEBUG] clickNextButton() a échoué - recherche du bouton 'Terminer'...");
                        // Pas de bouton suivant - peut-être qu'on doit terminer
                        setTimeout(() => {
                            const finishBtn = findFinishButton();
                            if (finishBtn) {
                                finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => {
                                    finishBtn.click();
                                    console.log("✅ Quiz terminé (après sélection)");
                                    isProcessing = false;
                                }, 1000);
                            } else {
                                isProcessing = false;
                            }
                        }, 1000);
                    } else {
                        // Le bouton a été trouvé et le clic est programmé
                        console.log("✅ Bouton trouvé, clic en cours...");
                        console.log("🔍 [DEBUG] Clic programmé - attente de 3 secondes avant de réinitialiser isProcessing...");
                // Réinitialiser isProcessing après un délai plus long pour laisser la page se charger
                setTimeout(() => {
                    console.log("🔄 Réinitialisation de isProcessing après clic sur bouton");
                    console.log("🔍 [DEBUG] isProcessing mis à false - la page devrait être chargée");
                    lastClickTime = Date.now(); // Enregistrer le temps du clic
                    console.log("🔍 [DEBUG] lastClickTime mis à jour:", lastClickTime);
                    isProcessing = false;
                }, 3000); // Augmenter à 3 secondes pour laisser la page se charger complètement
                    }
                }, 2500); // Augmenter le délai pour s'assurer que le bouton est activé et laisser la page se stabiliser
            } else {
                // Le choix n'a pas été sélectionné, réessayer
                console.log("⚠️ Le choix n'a pas été sélectionné, nouvel essai...");
                console.log("🔍 [DEBUG] isProcessing mis à false - nouvel essai dans 1.5 secondes");
                isProcessing = false;
                setTimeout(() => {
                    console.log("🔍 [DEBUG] Nouvel essai après échec de sélection...");
                    processPage();
                }, 1500);
            }
        }, 1000);
    } else {
        console.log("🔍 [DEBUG] clickRandomChoice() a échoué - isProcessing mis à false");
        isProcessing = false;
    }
    console.log("🔍 [DEBUG] Fin de processPage()");
}

// Observer les changements de la page pour détecter de nouvelles questions
let lastProcessedHash = '';
let lastClickTime = 0; // Timestamp du dernier clic sur un bouton
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

// Observer les changements de la page pour détecter de nouvelles questions
const observer = new MutationObserver(() => {
    // Le MutationObserver peut toujours être utile pour détecter les changements rapides
    // Mais on utilise principalement l'intervalle maintenant
});

// Exécuter processPage toutes les 2 secondes (ralentir pour éviter les bugs)
setInterval(() => {
    console.log("🔍 [DEBUG] Intervalle: vérification - isProcessing:", isProcessing);
    if (!isProcessing) {
        const currentHash = getPageHash();
        const choices = findAllChoices();
        
        // Vérifier si toutes les questions ont une réponse sélectionnée
        const groups = groupChoicesByQuestion(choices);
        const questionNames = Object.keys(groups);
        const allQuestionsAnswered = questionNames.length > 0 && questionNames.every(name => {
            const questionChoices = groups[name];
            return questionChoices.some(c => c.isChecked);
        });
        // Vérifier s'il y a des questions sans réponse (plus précis que hasUnselectedChoices)
        const hasUnansweredQuestions = questionNames.length > 0 && questionNames.some(name => {
            const questionChoices = groups[name];
            return !questionChoices.some(c => c.isChecked);
        });
        const timeSinceLastClick = Date.now() - lastClickTime;
        
        // Log détaillé pour chaque question
        console.log("🔍 [DEBUG] Détail des questions:", questionNames.map((name, idx) => {
            const questionChoices = groups[name];
            const hasAnswer = questionChoices.some(c => c.isChecked);
            const selectedChoice = questionChoices.find(c => c.isChecked);
            return `Question ${idx + 1} (${name}): ${hasAnswer ? 'répondu' : 'NON RÉPONDU'} (${questionChoices.length} choix)${hasAnswer ? ` - "${selectedChoice?.text?.substring(0, 30)}"` : ''}`;
        }));
        
        console.log("🔍 [DEBUG] Intervalle: état actuel", {
            currentHash: currentHash.substring(0, 50) + "...",
            lastProcessedHash: lastProcessedHash.substring(0, 50) + "...",
            hashChanged: currentHash !== lastProcessedHash,
            hasUnansweredQuestions: hasUnansweredQuestions,
            allQuestionsAnswered: allQuestionsAnswered,
            questionsCount: questionNames.length,
            choicesCount: choices.length,
            timeSinceLastClick: timeSinceLastClick,
            lastClickTime: lastClickTime
        });
        
        // Traiter si:
        // 1. La page a changé (nouvelle question)
        // 2. Il y a des questions sans réponse (besoin de sélectionner)
        // 3. Toutes les questions sont répondues mais on n'a pas cliqué récemment (besoin de cliquer sur le bouton)
        const shouldProcess = currentHash !== lastProcessedHash || hasUnansweredQuestions || (allQuestionsAnswered && timeSinceLastClick > 2000);
        
        console.log("🔍 [DEBUG] Décision shouldProcess:", {
            hashChanged: currentHash !== lastProcessedHash,
            hasUnansweredQuestions: hasUnansweredQuestions,
            allQuestionsAnswered: allQuestionsAnswered,
            timeSinceLastClick: timeSinceLastClick,
            condition3: allQuestionsAnswered && timeSinceLastClick > 2000,
            shouldProcess: shouldProcess
        });
        
        if (shouldProcess) {
            console.log("🔄 Intervalle: changement détecté", {
                hashChanged: currentHash !== lastProcessedHash,
                hasUnansweredQuestions: hasUnansweredQuestions,
                allQuestionsAnswered: allQuestionsAnswered,
                timeSinceLastClick: timeSinceLastClick,
                choicesCount: choices.length,
                questionsCount: questionNames.length
            });
            lastProcessedHash = currentHash;
            // Attendre un peu avant de traiter pour laisser la page se stabiliser
            console.log("🔍 [DEBUG] Intervalle: attente de 500ms avant de traiter...");
            setTimeout(() => {
                if (!isProcessing) {
                    console.log("🔍 [DEBUG] Intervalle: appel de processPage()");
                    processPage();
                } else {
                    console.log("🔍 [DEBUG] Intervalle: processPage() ignoré car isProcessing=true");
                }
            }, 500);
        } else {
            console.log("🔍 [DEBUG] Intervalle: aucun changement détecté");
        }
    } else {
        console.log("⏸️ Intervalle: isProcessing=true, attente...");
    }
}, 2000); // Toutes les 2 secondes pour ralentir

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



