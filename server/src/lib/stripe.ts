import Stripe from 'stripe';
import { config } from '../config';

export const stripe = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey)
  : (null as unknown as Stripe);
