#!/bin/bash

echo "============================================"
echo "       TELEPHASMA - Setup and Launch"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backend setup
echo "[1/4] Creating Python virtual environment..."
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Could not create Python venv!"
        echo "Make sure Python 3.10+ is installed."
        exit 1
    fi
fi
echo "      Virtual environment ready!"

echo ""
echo "[2/4] Installing backend dependencies..."
source .venv/bin/activate
pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    echo "ERROR: pip install failed!"
    exit 1
fi
echo "      Dependencies installed!"

# Frontend setup
echo ""
echo "[3/4] Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: npm install failed!"
        echo "Make sure Node.js 18+ is installed."
        exit 1
    fi
fi
echo "      Frontend ready!"

# Start the application
echo ""
echo "[4/4] Starting application..."
echo ""
echo "============================================"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend in background
cd "$SCRIPT_DIR/backend"
source .venv/bin/activate
python main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend in background
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait then open browser
sleep 3
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
elif command -v open &> /dev/null; then
    open http://localhost:5173
fi

echo ""
echo "Application started! Browser should open automatically."
echo "Press Ctrl+C to stop."

# Handle Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for both processes
wait
