//INR_BALANCES interfaces
export interface Userbalance {
  balance: number;
  locked: number;
}

export interface INRBalances {
  [userId: string]: Userbalance;
}

// ORDERBOOK interfaces
export interface Order {
  quantity: number;
  userId: string;
  type: "buy" | "sell";
}

export interface PriceLevel {
  total: number;
  orders: Order[];
}

interface TokenType {
  [price: string]: PriceLevel;
}

interface Symbol {
  yes: TokenType;
  no: TokenType;
}

export interface OrderBook {
  [symbol: string]: Symbol;
}

//STOCK_BALANCES interfaces
export interface Quantity {
  quantity: number;
  locked: number;
}

export type StockPosition = {
  yes: Quantity;
  no: Quantity;
};

export interface StockName {
  [stockSymbol: string]: StockPosition;
}

export interface StockBalances {
  [userId: string]: StockName;
}

//onramp request
export interface OnrampRequest {
  userId: string;
  amount: number;
}

// sell order request body
export interface OrderRequestBody {
  userId: string;
  stockSymbol: string;
  quantity: number;
  price: number;
  stockType: "yes" | "no";
}
