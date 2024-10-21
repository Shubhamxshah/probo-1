import express,{Request, Response} from "express";
import { INRBalances, OrderBook, OrderRequestBody, StockBalances, PriceLevel } from "./types";

const app = express();
app.use(express.json());

const INR_BALANCES: INRBalances = {};

const ORDERBOOK: OrderBook = {};

const STOCK_BALANCES: StockBalances = {};

function resetBalances() {
  Object.keys(INR_BALANCES).forEach(key => delete INR_BALANCES[key]);
  Object.keys(STOCK_BALANCES).forEach(key => delete STOCK_BALANCES[key]);
  Object.keys(ORDERBOOK).forEach(key => delete ORDERBOOK[key]);
}

app.post("/user/create/:userId", (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (userId in INR_BALANCES) {
       res.status(400).json({ message: `User ${userId} already exists` });
    }

    INR_BALANCES[userId] = { balance: 0, locked: 0 };
     res.status(201).json({ message: `User ${userId} created` });
  } catch (error) {
     res.status(500).json({
      error: error instanceof Error ? error.message : 'Error occurred in /user/create/:userId'
    });
  }
});

app.post("/onramp/inr", (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    if (typeof userId !== 'string' || typeof amount !== 'number' || amount <= 0) {
       res.status(400).json({
        error: 'Invalid Input. UserId must be a string and amount must be a positive number'
      });
    }

    if (!(userId in INR_BALANCES)) {
       res.status(400).json({ message: `User ${userId} doesn't exist` });
    }
    INR_BALANCES[userId].balance += amount;

     res.status(200).json({ message: `Onramped ${userId} with amount ${amount}` });
  } catch (error) {
     res.status(400).json({
      error: error instanceof Error ? error.message : 'Error occurred in /onramp/inr'
    });
  }
});

app.get("/balances/inr", (_req: Request, res: Response) => {
   res.status(200).json(INR_BALANCES);
});

app.get("/balances/stock", (_req: Request, res: Response) => {
   res.status(200).json(STOCK_BALANCES);
});

app.get("/orderbook", (_req: Request, res: Response) => {
   res.status(200).json(ORDERBOOK);
});

app.get("/balances/inr/:userId", (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!INR_BALANCES[userId]) {
     res.status(400).json({ message: `No such userId exists` });
  }
   res.status(200).json(INR_BALANCES[userId]);
});

app.get("/orderbook/:stockSymbol", (req: Request, res: Response) => {
  const stockSymbol = req.params.stockSymbol;
  if (!ORDERBOOK[stockSymbol]) {
     res.status(404).json({ message: `No orderbook found for ${stockSymbol}` });
  }
   res.status(200).json(ORDERBOOK[stockSymbol]);
});

app.get("/balances/stock/:userId", (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!STOCK_BALANCES[userId]) {
     res.status(404).json({ message: `No stock balances found for user ${userId}` });
  }
   res.status(200).json(STOCK_BALANCES[userId]);
});

app.post("/reset", (_req: Request, res: Response) => {
  try {
    resetBalances();
     res.status(200).json({ message: `Objects reset done` });
  } catch (error) {
     res.status(500).json({
      error: error instanceof Error ? error.message : 'Error occurred in /reset'
    });
  }
});

const yesOrderValues: Record<string, PriceLevel> = {};
for (let i = 50; i <= 950; i += 50) {
  yesOrderValues[i] = { total: 0, orders: [] };
}

const noOrderValues: Record<string, PriceLevel> = {};
for (let i = 50; i <= 950; i += 50) {
  noOrderValues[i] = { total: 0, orders: [] };
}


app.post("/symbol/create/:stockSymbol", (req: Request, res: Response) => {
  try {
    const symbol = req.params.stockSymbol;
    
    if (!ORDERBOOK[symbol]) {
      ORDERBOOK[symbol] = { yes: yesOrderValues , no: noOrderValues };
    }

     res.status(201).json({ message: `Symbol ${symbol} created` });
  } catch (error) {
     res.status(400).json({
      error: error instanceof Error ? error.message : 'Error occurred in /symbol/create'
    });
  }
});

app.post("/trade/mint", (req: Request, res: Response) => {
  try {
    const { userId, stockSymbol, quantity, price } = req.body;

    if (!userId || !stockSymbol || typeof quantity !== 'number' || typeof price !== 'number') {
       res.status(400).json({ error: `Incorrect input body parameters` });
    }

    const userBalance = INR_BALANCES[userId]?.balance;
    
    if (userBalance === undefined) {
       res.status(400).json({ error: `No such userId exists yet. Please create one` });
    }

    const totalCost = price * quantity;

    if (userBalance < totalCost) {
       res.status(400).json({ error: `User balance insufficient` });
    }

    if (!STOCK_BALANCES[userId]) {
      STOCK_BALANCES[userId] = {};
    }

    if (!STOCK_BALANCES[userId][stockSymbol]) {
      STOCK_BALANCES[userId][stockSymbol] = {
        yes: { quantity: 0, locked: 0 },
        no: { quantity: 0, locked: 0 }
      };
    }

    INR_BALANCES[userId].balance -= totalCost;
    STOCK_BALANCES[userId][stockSymbol].yes.quantity += quantity;
    STOCK_BALANCES[userId][stockSymbol].no.quantity += quantity;

     res.status(201).json({
      message: `Minted ${quantity} 'yes' and 'no' tokens for user ${userId}, remaining balance is ${INR_BALANCES[userId].balance}`
    });
  } catch (error) {
     res.status(400).json({
      error: error instanceof Error ? error.message : `Error occurred in /trade/mint`
    });
  }
});

app.post('/order/sell', (req, res) => {
  try {
    const {userId, stockSymbol, quantity, price, stockType} = req.body as OrderRequestBody;
   
    if (!userId || !stockSymbol || !quantity || !price || !stockType) {
       res.status(400).json({ message: `Missing required params`});
    }

    if ( price < 50 || price > 950 || price % 50 !== 0) {
       res.status(400).json({message: `Price is not valid, should be between 0.5 and 9.5 and in 0.5 increments`})
    }

    const userPosition = STOCK_BALANCES[userId]?.[stockSymbol];
    if (!userPosition){
       res.status(400).json({message: `user doesnt have this token`})
    }

    const stockQuantity = userPosition[stockType];

    if (stockQuantity.quantity < quantity) {
       res.status(400).json({message: `user doesnt have enough tokens to sell`});
    }
    
    stockQuantity.quantity -= quantity;
    stockQuantity.locked += quantity;

    ORDERBOOK[stockSymbol][stockType][price].total += quantity;
    ORDERBOOK[stockSymbol][stockType][price].orders.push({quantity: quantity,userId: userId, type: 'sell'}); 

     res.status(200).json({
      message: `Sell order placed for ${quantity} '${stockType}'`
    })

  } catch (error) {
     res.status(400).json({
      error: error instanceof Error ? error.message: `error occured in /order/sell`
    })
  }
})

app.post('/order/buy', (req: Request, res: Response) => {
  try {
const { userId, stockSymbol, quantity, price, stockType } = req.body as OrderRequestBody;

if (!userId || !stockSymbol || !quantity || !price || !stockType) {
   res.status(400).json({ message: `Missing required params` });
}

if (price < 50 || price > 950 || price % 50 !== 0) {
   res.status(400).json({ message: `Price is not valid, should be between 0.5 and 9.5 and in 0.5 increments` });
}

if (!ORDERBOOK[stockSymbol]) {
   res.status(400).json({ message: `The stockSymbol is missing in orderbook. Please create one` });
}
const totalCost = price * quantity;
const userBalance = INR_BALANCES[userId]?.balance;

if (userBalance === undefined) {
   res.status(400).json({ error: `No such userId exists yet. Please create one` });
}

if (userBalance < totalCost) {
   res.status(400).json({ error: `User balance insufficient` });
}

let remainingQuantity = quantity;
let totalSpent = 0;
const oppositeSide = stockType === 'yes' ? 'no' : 'yes';
const oppositePrice = 1000 - price;

// Deduct total cost from user's balance and lock it
INR_BALANCES[userId].balance -= totalCost;
INR_BALANCES[userId].locked += totalCost;

// Check for matching sell orders
for (let i = 50; i <= price && remainingQuantity > 0; i += 50) {
  const priceLevel = ORDERBOOK[stockSymbol][stockType][i];
  if (priceLevel.total > 0) {
    const executedQuantity = Math.min(remainingQuantity, priceLevel.total);
    remainingQuantity -= executedQuantity;
    const executionCost = executedQuantity * i;
    totalSpent += executionCost;

    // Update orderbook
    priceLevel.total -= executedQuantity;

    const indexesToDelete : number[] = [];

    for (let index = 0; index < priceLevel.orders.length; index++) {
      const sellOrder = priceLevel.orders[index];    
      const numSellOrderQuantity = sellOrder.quantity;
      const sellerUserId = sellOrder.userId;
      const orderType = sellOrder.type;

          if (numSellOrderQuantity <= executedQuantity) {
        indexesToDelete.push(index);

        // Update seller's balance and stock
        if (INR_BALANCES[sellerUserId]) {
          if (orderType === 'sell') {
            INR_BALANCES[sellerUserId].balance += numSellOrderQuantity * i;
            STOCK_BALANCES[sellerUserId][stockSymbol][stockType].locked -= numSellOrderQuantity;
          } else {
            // If it was originally a buy order, unlock the funds and update stock
            const originalBuyPrice = 1000 - i;
            INR_BALANCES[sellerUserId].locked -= numSellOrderQuantity * originalBuyPrice;
            STOCK_BALANCES[sellerUserId][stockSymbol][oppositeSide].quantity += numSellOrderQuantity;
          }
        }
      } else {
        const remainingSellOrderQuantity = numSellOrderQuantity - executedQuantity;    
        priceLevel.orders[index].quantity = remainingSellOrderQuantity;

        // Update seller's balance and stock
        if (INR_BALANCES[sellerUserId]) {
          if (orderType === 'sell') {
            INR_BALANCES[sellerUserId].balance += executedQuantity * i;
            STOCK_BALANCES[sellerUserId][stockSymbol][stockType].locked -= executedQuantity;
          } else {
            // If it was originally a buy order, unlock the funds and update stock
            const originalBuyPrice = 1000 - i;
            INR_BALANCES[sellerUserId].locked -= executedQuantity * originalBuyPrice;
            STOCK_BALANCES[sellerUserId][stockSymbol][oppositeSide].quantity += executedQuantity;
          }
        }
        break;
      }
    };

    for (let i = indexesToDelete.length - 1; i >= 0; i--) {
      priceLevel.orders.splice(indexesToDelete[i], 1);
    }

    // Update buyer's stock balance
    if (!STOCK_BALANCES[userId]) STOCK_BALANCES[userId] = {};
    if (!STOCK_BALANCES[userId][stockSymbol]) STOCK_BALANCES[userId][stockSymbol] = { yes: { quantity: 0, locked: 0 }, no: { quantity: 0, locked: 0 } };
    STOCK_BALANCES[userId][stockSymbol][stockType].quantity += executedQuantity;

    // Unlock the spent amount
    INR_BALANCES[userId].locked -= executionCost;
  }
}

// If there's remaining quantity, create a new order
if (remainingQuantity > 0) {
  const priceString = oppositePrice;

  ORDERBOOK[stockSymbol][oppositeSide][priceString].total += remainingQuantity;
  ORDERBOOK[stockSymbol][oppositeSide][priceString].orders.push({quantity: quantity, userId: userId, type: 'buy'});

  // The funds for the remaining quantity are already locked, so no need to lock again
}

 res.status(200).json({
  message: `Buy order processed. ${quantity - remainingQuantity} ${stockType} tokens bought at market price. ${remainingQuantity} ${oppositeSide} tokens listed for sale.`
});
   } catch (error) {
 res.status(400).json({
  error: error instanceof Error ? error.message : `Error occurred in /order/buy`
});
   }
 });

//  app.post('/order/cancel', (req: Request, res: Response) => {
//    try {
// const { userId, stockSymbol, price, stockType, quantity } = req.body as OrderRequestBody;
//
// if (!userId || !stockSymbol || !price || !stockType || !quantity) {
//    res.status(400).json({ message: `Missing required params` });
// }
//
// const priceString = price;
// const priceLevel = ORDERBOOK[stockSymbol][stockType][priceString];
//
// if (!priceLevel || !priceLevel.orders[quantity] || !priceLevel.orders[quantity][userId]) {
//    res.status(400).json({ message: `Order not found` });
// }
//
// const orderType = priceLevel.orders[quantity][userId];
//
// // Remove the order from the orderbook
// delete priceLevel.orders[quantity];
// priceLevel.total -= quantity;
//
// // Update user's balance and stock
// if (orderType === 'buy') {
//   // Unlock funds for buy orders
//   INR_BALANCES[userId].locked -= quantity * price;
//   INR_BALANCES[userId].balance += quantity * price;
//  } else {
//    // Return stocks for sell orders
//    STOCK_BALANCES[userId][stockSymbol][stockType].locked -= quantity;
//    STOCK_BALANCES[userId][stockSymbol][stockType].quantity += quantity;
//  }
//
//   res.status(200).json({
//    message: `Order cancelled successfully`
//  });
//     } catch (error) {
//   res.status(400).json({
//    error: error instanceof Error ? error.message : `Error occurred in /order/cancel`
//  });
//     }
//  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
