export interface PriceEvent {
  type: "price";
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface CandleEvent {
  type: "candle";
  symbol: string;
  timeframe: string;
  candle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

export interface ScoringEvent {
  type: "scoring";
  scores: Array<{ symbol: string; score: number }>;
}

export type StreamEvent = PriceEvent | CandleEvent | ScoringEvent;
