// Popup script pour contrôler la sélection aléatoire

document.getElementById('clickRandomBtn').addEventListener('click', async () => {
  const statusContainer = document.getElementById('statusContainer');
  statusContainer.innerHTML = '⏳ Sélection en cours...';
  statusContainer.style.backgroundColor = '#fff3e0';
  statusContainer.style.color = '#e65100';

  try {
    // Obtenir l'onglet actif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Vérifier que nous sommes sur GlobalExam
    if (!tab.url.includes('global-exam.com')) {
      statusContainer.innerHTML = '❌ Veuillez ouvrir une page GlobalExam';
      statusContainer.style.backgroundColor = '#ffebee';
      statusContainer.style.color = '#c62828';
      return;
    }

    // Envoyer un message au content script
    chrome.tabs.sendMessage(tab.id, { action: 'clickRandom' }, (response) => {
      if (chrome.runtime.lastError) {
        statusContainer.innerHTML = `❌ Erreur: ${chrome.runtime.lastError.message}`;
        statusContainer.style.backgroundColor = '#ffebee';
        statusContainer.style.color = '#c62828';
        return;
      }

      if (response && response.success) {
        statusContainer.innerHTML = '✅ Sélection aléatoire effectuée !';
        statusContainer.style.backgroundColor = '#e8f5e9';
        statusContainer.style.color = '#2e7d32';
        
        // Remettre le message par défaut après 2 secondes
        setTimeout(() => {
          statusContainer.innerHTML = '✅ Extension active - Sélection automatique en cours';
        }, 2000);
      }
    });
  } catch (error) {
    statusContainer.innerHTML = `❌ Erreur: ${error.message}`;
    statusContainer.style.backgroundColor = '#ffebee';
    statusContainer.style.color = '#c62828';
  }
});

