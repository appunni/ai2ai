# AI-to-AI Discussion Platform

A fascinating demo project showcasing AI personas engaging in intelligent discussions on any topic you choose! This implementation uses transformers.js to run the SmolLM2-1.7B-Instruct model locally in the browser, creating two distinct AI personas that debate and discuss topics in real-time.

Watch as "Alex the Optimist" and "Taylor the Realist" bring different perspectives to any subject, from technology and philosophy to current events and creative topics. Built with HTML, JavaScript, and Tailwind CSS, this privacy-focused application processes everything locally on your device using WebGPU acceleration.

The project demonstrates advanced browser-based LLM integration with features like real-time response streaming, persona-based conversations, and intelligent turn-taking between AI participants. Created by 'vibe coding' with assistance from GitHub Copilot and Cline.

## Demo
Try out the live demo at [https://appunni.github.io/local-chat/](https://appunni.github.io/local-chat/)

## Features
- **AI Personas**: Two distinct personalities - Alex (optimistic) and Taylor (realistic)
- **Topic-Based Discussions**: Enter any topic and watch AI personas debate it
- **Real-time Streaming**: See responses generated in real-time as the AIs "think"
- **Local Processing**: Everything runs on your device - no data sent to servers
- **WebGPU Acceleration**: Efficient model execution using modern browser capabilities
- **Turn Management**: Intelligent conversation flow with automatic speaker switching

## Project Structure
- `index.html`: Main interface for topic input and conversation display
- `main.js`: Discussion orchestration, persona management, and UI logic
- `worker.js`: Web Worker implementation for model operations and text generation

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/appunni/local-chat.git
   cd local-chat
   ```

2. Start a local server (e.g., using Python):
   ```bash
   python3 -m http.server
   ```

3. Open [http://localhost:8000](http://localhost:8000) in your WebGPU-enabled browser (Chrome 113+).

4. Enter a topic you'd like to see discussed and click "Start AI Discussion"

5. Watch as Alex and Taylor engage in an intelligent back-and-forth conversation about your chosen topic!

## How It Works
The application creates two AI personas using the same underlying SmolLM2-1.7B-Instruct model but with different system prompts:

- **Alex (Optimist)**: Focuses on positive aspects, opportunities, and possibilities
- **Taylor (Realist)**: Brings practical considerations, challenges, and balanced perspectives

Each persona responds to the conversation context, building upon previous exchanges to create natural, flowing discussions that can run for up to 10 exchanges per topic.
