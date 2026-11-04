# 🚀 Quick Start - Unified Agent System

## What You Have

✅ **Unified AI Agent** - Analyzes stocks across 8 sectors  
✅ **LLM Integration** - Ollama running with llama3  
✅ **API Endpoints** - Ready to test  
✅ **Complete Documentation** - Implementation plans ready  

## 1️⃣ Start Backend (Right Now!)

```bash
cd backend
npm run start:dev
```

If dependencies aren't installed yet:
```bash
npm install --save @nestjs/config class-validator class-transformer axios
```

## 2️⃣ Test Unified Agent

### Test All Sectors

```bash
# Technology
curl http://localhost:3001/api/agents/test/Technology | jq '.analysis.scores'

# AI & Semiconductors
curl http://localhost:3001/api/agents/test/AI | jq '.analysis.scores'

# Healthcare
curl http://localhost:3001/api/agents/test/Healthcare | jq '.analysis.scores'

# Energy
curl http://localhost:3001/api/agents/test/Energy | jq '.analysis.scores'

# Financial Services
curl http://localhost:3001/api/agents/test/Financial | jq '.analysis.scores'

# Real Estate
curl http://localhost:3001/api/agents/test/RealEstate | jq '.analysis.scores'

# Commodities
curl http://localhost:3001/api/agents/test/Commodities | jq '.analysis.scores'

# Consumer & Retail
curl http://localhost:3001/api/agents/test/Consumer | jq '.analysis.scores'
```

### See Full Analysis

```bash
curl http://localhost:3001/api/agents/test/Technology | jq '.'
```

### Test Script

```bash
# Save as test-agent.sh
#!/bin/bash
for sector in Technology AI Healthcare Energy Financial RealEstate Commodities Consumer; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🤖 Testing $sector Sector"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s "http://localhost:3001/api/agents/test/$sector" | jq '{
    sector: .analysis.sector,
    scores: .analysis.scores,
    recommendation: .analysis.recommendation,
    confidence: .analysis.confidence
  }'
  echo ""
done
```

Run it:
```bash
chmod +x test-agent.sh
./test-agent.sh
```

## 3️⃣ Test Real Stock Analysis

```bash
curl -X POST http://localhost:3001/api/agents/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stockData": {
      "symbol": "NVDA",
      "companyName": "NVIDIA Corporation",
      "sector": "AI",
      "industry": "Semiconductors",
      "price": {
        "current": 485.50,
        "open": 482.0,
        "high": 488.0,
        "low": 481.5,
        "close": 485.50,
        "volume": 45000000
      },
      "fundamentals": {
        "marketCap": 1200000000000,
        "pe": 65.2,
        "eps": 7.45,
        "beta": 1.7,
        "revenue": 60000000000,
        "netIncome": 30000000000,
        "revenueGrowth": 126.5
      },
      "technical": {
        "sma20": 475.0,
        "sma50": 455.0,
        "sma200": 420.0,
        "rsi": 68.5,
        "macd": {
          "value": 8.5,
          "signal": 6.2,
          "histogram": 2.3
        }
      },
      "sentiment": {
        "score": 0.8,
        "newsCount": 25
      }
    },
    "job": {
      "sector": "AI"
    }
  }' | jq '.'
```

## 4️⃣ Check System Status

```bash
# Health check
curl http://localhost:3001/api/health

# LLM status
curl http://localhost:3001/api/llm/status

# Test LLM
curl -X POST http://localhost:3001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain P/E ratio in one sentence."}'
```

## 📊 What to Expect

### Example Output:

```json
{
  "success": true,
  "analysis": {
    "symbol": "AAPL",
    "sector": "Technology",
    "scores": {
      "overall": 72,
      "technical": 75,
      "fundamental": 78,
      "sentiment": 80,
      "risk": 65
    },
    "recommendation": "BUY",
    "confidence": 0.75,
    "reasoning": "AI-generated analysis...",
    "targets": {
      "entryPoint": 171.92,
      "targetPrice": 201.74,
      "stopLoss": 158.17,
      "exitPoint": 186.74
    },
    "prediction": {
      "direction": "bullish",
      "timeframe": "medium-term (3-6 months)",
      "confidence": 0.75
    }
  }
}
```

## 🎯 Next Steps

### Option 1: Continue Testing
- Test different sectors
- Try different stock data
- Analyze batch requests

### Option 2: Add Market Data (Phase 1)
```bash
# Install Alpha Vantage client
npm install --save axios

# Get free API key from:
# https://www.alphavantage.co/support/#api-key
```

### Option 3: Setup Database (Phase 1)
```bash
# Install PostgreSQL (Docker)
docker run --name hyperdrive-postgres \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=hyperdrive \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### Option 4: Build Frontend (Phase 5)
```bash
cd frontend
npm run dev

# Visit http://localhost:3000
```

## 📚 Documentation

- **Main Guide**: `Agents/UNIFIED_AGENT_GUIDE.md`
- **Implementation Plan**: `Agents/IMPLEMENTATION_PLAN.md`
- **Setup Status**: `Agents/SETUP_STATUS.md`
- **Architecture**: `Agents/ARCHITECTURE.md`

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -ti:3001

# Kill process if needed
kill -9 $(lsof -ti:3001)

# Restart
npm run start:dev
```

### Ollama not working
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Pull llama3 if needed
ollama pull llama3
```

### Dependencies not installed
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

## ✅ Success Checklist

- [ ] Backend starts without errors
- [ ] `/api/health` returns OK
- [ ] `/api/llm/status` shows Ollama available
- [ ] `/api/agents/test/Technology` returns analysis
- [ ] All 8 sector tests pass
- [ ] LLM generates reasoning text
- [ ] Scores are calculated correctly

## 🎉 You're Ready!

Your unified agent system is working! You can now:

1. ✅ Analyze stocks across 8 sectors
2. ✅ Get AI-powered recommendations
3. ✅ Calculate price targets
4. ✅ Generate predictions
5. ✅ Test via simple API calls

**Next**: Integrate real market data and build the frontend UI!

---

**Quick Test**:
```bash
curl http://localhost:3001/api/agents/test/Technology | jq '.analysis.recommendation'
```

Expected: `"BUY"` or `"HOLD"` or similar
