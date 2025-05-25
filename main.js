// Initialize the worker but don't load model automatically
const worker = new Worker('worker.js', { type: 'module' });
console.log('Web Worker initialized');

// UI Elements
const modelInfo = document.getElementById('model-info');
const chatInterface = document.getElementById('chat-interface');
const loadModelButton = document.getElementById('load-model');
const loadingDiv = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const chatMessages = document.getElementById('chat-messages');
const topicInput = document.getElementById('topic-input');
const startDiscussionButton = document.getElementById('start-discussion');
const stopDiscussionButton = document.getElementById('stop-discussion');
const newTopicButton = document.getElementById('new-topic');

// Progress tracking elements
const modelProgress = document.getElementById('model-progress');
const modelPercent = document.getElementById('model-percent');
const bytesLoaded = document.getElementById('bytes-loaded');

// Model size in bytes (1.7B model is roughly 1.1 GB)
const MODEL_SIZE = 1.1 * 1024 * 1024 * 1024;

// AI Personas
const personas = {
    alex: {
        name: "Alex (Optimist)",
        color: "bg-blue-100 border-l-4 border-blue-500",
        textColor: "text-blue-800",
        systemPrompt: "You are Alex, an optimistic and enthusiastic AI persona. You tend to see the positive side of things, focus on opportunities and possibilities, and bring energy to discussions. You're knowledgeable but approach topics with hope and excitement. Keep your responses conversational and engaging, typically 2-3 sentences."
    },
    taylor: {
        name: "Taylor (Realist)",
        color: "bg-gray-100 border-l-4 border-gray-500", 
        textColor: "text-gray-800",
        systemPrompt: "You are Taylor, a realistic and analytical AI persona. You tend to focus on practical considerations, potential challenges, and balanced perspectives. You're thoughtful and measured in your responses, often bringing up important nuances or complications. Keep your responses conversational and engaging, typically 2-3 sentences."
    }
};

// Discussion state
let currentTopic = '';
let discussionHistory = [];
let currentSpeaker = 'alex';
let discussionActive = false;
let turnCount = 0;
const MAX_TURNS = 10;

// Check WebGPU support and load the model
async function initialize() {
    console.log('Initializing chat application...');
    showLoading();
    worker.postMessage({ type: 'check' });
    worker.postMessage({ type: 'load' });
}

function showLoading() {
    console.log('Showing loading UI');
    loadingDiv.classList.remove('hidden');
    topicInput.disabled = true;
    startDiscussionButton.disabled = true;
}

function hideLoading() {
    console.log('Hiding loading UI');
    loadingDiv.classList.add('hidden');
    topicInput.disabled = false;
    startDiscussionButton.disabled = false;
}

// Scroll chat to bottom
function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

// Add a message to the discussion
function addMessage(content, speaker) {
    console.log(`Adding ${speaker} message:`, content);
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-4';

    const persona = personas[speaker];
    const messageBubble = document.createElement('div');
    messageBubble.className = `p-4 rounded-lg ${persona.color}`;
    
    const speakerName = document.createElement('div');
    speakerName.className = `font-semibold ${persona.textColor} mb-2`;
    speakerName.textContent = persona.name;
    
    const messageContent = document.createElement('div');
    messageContent.className = `${persona.textColor} message-content`;
    messageContent.style.whiteSpace = 'pre-wrap';
    messageContent.textContent = content;

    messageBubble.appendChild(speakerName);
    messageBubble.appendChild(messageContent);
    messageDiv.appendChild(messageBubble);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Start a new discussion
async function startDiscussion() {
    const topic = topicInput.value.trim();
    if (!topic) return;

    console.log('Starting discussion on topic:', topic);
    currentTopic = topic;
    discussionHistory = [];
    turnCount = 0;
    discussionActive = true;
    currentSpeaker = 'alex';

    // Clear previous messages
    chatMessages.innerHTML = '';
    
    // Add topic introduction
    const topicDiv = document.createElement('div');
    topicDiv.className = 'mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg';
    topicDiv.innerHTML = `
        <div class="font-semibold text-green-800 mb-2">Discussion Topic:</div>
        <div class="text-green-700">${topic}</div>
    `;
    chatMessages.appendChild(topicDiv);

    // Update UI
    topicInput.disabled = true;
    startDiscussionButton.disabled = true;
    stopDiscussionButton.classList.remove('hidden');
    
    // Reset worker cache to prevent contamination
    worker.postMessage({ type: 'reset' });
    
    // Start the conversation
    generateNextResponse();
}

// Generate the next response in the discussion
async function generateNextResponse() {
    if (!discussionActive || turnCount >= MAX_TURNS) {
        endDiscussion();
        return;
    }

    const persona = personas[currentSpeaker];
    const otherSpeaker = currentSpeaker === 'alex' ? 'taylor' : 'alex';
    
    // Build conversation context
    let conversationContext = '';
    
    if (discussionHistory.length === 0) {
        conversationContext = `Topic: ${currentTopic}\n\nAs ${persona.name}, provide your initial thoughts on this topic.`;
    } else {
        conversationContext = `Topic: ${currentTopic}\n\nPrevious discussion:\n`;
        discussionHistory.forEach(entry => {
            conversationContext += `${personas[entry.speaker].name}: ${entry.content}\n`;
        });
        conversationContext += `\nNow respond as ${persona.name}. Build on what was said and add your perspective.`;
    }

    const messages = [
        { role: "system", content: persona.systemPrompt },
        { role: "user", content: conversationContext }
    ];

    console.log('Generating response for:', persona.name);
    worker.postMessage({
        type: 'generate',
        data: messages,
        speaker: currentSpeaker
    });
}

// End the discussion
function endDiscussion() {
    console.log('Ending discussion');
    discussionActive = false;
    stopDiscussionButton.classList.add('hidden');
    newTopicButton.classList.remove('hidden');
    
    // Add conclusion message
    const conclusionDiv = document.createElement('div');
    conclusionDiv.className = 'mt-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-lg';
    conclusionDiv.innerHTML = `
        <div class="font-semibold text-purple-800 mb-2">Discussion Complete</div>
        <div class="text-purple-700">The AI discussion on "${currentTopic}" has concluded after ${turnCount} exchanges.</div>
    `;
    chatMessages.appendChild(conclusionDiv);
    scrollToBottom();
}

// Reset for new topic
function resetForNewTopic() {
    currentTopic = '';
    discussionHistory = [];
    turnCount = 0;
    discussionActive = false;
    currentSpeaker = 'alex';
    
    chatMessages.innerHTML = '';
    topicInput.value = '';
    topicInput.disabled = false;
    startDiscussionButton.disabled = false;
    stopDiscussionButton.classList.add('hidden');
    newTopicButton.classList.add('hidden');
    
    // Reset worker conversation cache
    worker.postMessage({ type: 'reset' });
}

// Event handlers
startDiscussionButton.addEventListener('click', startDiscussion);

stopDiscussionButton.addEventListener('click', () => {
    discussionActive = false;
    worker.postMessage({ type: 'interrupt' });
    endDiscussion();
});

newTopicButton.addEventListener('click', resetForNewTopic);

topicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !startDiscussionButton.disabled) {
        startDiscussion();
    }
});

// Handle worker messages
let currentAssistantMessage = '';
let currentResponseSpeaker = '';

worker.addEventListener('message', (e) => {
    const { status, data, output, type, progress, speaker } = e.data;
    console.log('Received worker message:', e.data);

    switch (status) {
        case 'error':
            console.error('Error from worker:', data);
            loadingText.textContent = 'Error: ' + data;
            hideLoading();
            startDiscussionButton.disabled = false;
            topicInput.disabled = false;
            discussionActive = false;
            break;

        case 'loading':
            console.log('Loading status:', data);
            loadingDiv.classList.remove('hidden');
            loadingText.textContent = data;
            break;

        case 'progress':
            loadingDiv.classList.remove('hidden');
            const loaded = e.data.loaded || 0;
            if (loaded > 0) {
                const progress = Math.min((loaded / MODEL_SIZE) * 100, 100);
                const roundedProgress = Math.round(progress);
                modelProgress.style.width = `${progress}%`;
                modelPercent.textContent = `${roundedProgress}%`;
                
                const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
                bytesLoaded.textContent = `${loadedMB} MB loaded`;
            }
            
            if (e.data.modelName && loadingText) {
                loadingText.textContent = `Loading ${e.data.modelName}`;
            }
            break;

        case 'progress_complete':
            modelProgress.style.width = '100%';
            modelPercent.textContent = '100%';
            bytesLoaded.textContent = `${(MODEL_SIZE / (1024 * 1024)).toFixed(1)} MB loaded`;
            if (e.data.modelName) {
                loadingText.textContent = `Loading ${e.data.modelName} complete`;
            }
            break;

        case 'ready':
            console.log('Components loaded successfully');
            loadingText.textContent = 'Ready for AI discussions!';
            bytesLoaded.textContent = 'Loading complete';
            setTimeout(hideLoading, 1500);
            break;

        case 'start':
            console.log('Starting new generation for speaker:', speaker);
            currentAssistantMessage = '';
            currentResponseSpeaker = speaker || currentSpeaker;
            // Add an empty message div that we'll update with tokens
            addMessage('', currentResponseSpeaker);
            break;

        case 'token':
            if (output && discussionActive) {
                currentAssistantMessage += output;
                const lastMessage = chatMessages.lastElementChild?.querySelector('.message-content');
                if (lastMessage) {
                    lastMessage.textContent = currentAssistantMessage;
                    scrollToBottom();
                }
            }
            break;

        case 'complete':
            console.log('Generation complete for speaker:', currentResponseSpeaker);
            if (discussionActive && currentAssistantMessage.trim()) {
                // Add to discussion history
                discussionHistory.push({
                    speaker: currentResponseSpeaker,
                    content: currentAssistantMessage.trim()
                });
                
                turnCount++;
                
                // Switch speaker for next turn
                currentSpeaker = currentSpeaker === 'alex' ? 'taylor' : 'alex';
                
                // Continue discussion after a 2-second delay
                setTimeout(() => {
                    if (discussionActive && turnCount < MAX_TURNS) {
                        generateNextResponse();
                    } else if (turnCount >= MAX_TURNS) {
                        endDiscussion();
                    }
                }, 2000);
            }
            break;
    }
});

// Add load model button click handler
loadModelButton.addEventListener('click', () => {
    console.log('Starting model initialization...');
    modelInfo.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    initialize();
});
