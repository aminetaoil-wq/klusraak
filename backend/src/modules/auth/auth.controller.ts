import type { Request, Response } from 'express';
import * as service from './auth.service';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.schemas';

export const register = async (req: Request, res: Response) => {
  const result = await service.register(req.body as RegisterInput);
  res.status(201).json(result);
};

export const login = async (req: Request, res: Response) => {
  const result = await service.login(req.body as LoginInput);
  res.json(result);
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  const result = await service.refresh(refreshToken);
  res.json(result);
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  await service.logout(refreshToken);
  res.status(204).send();
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await service.getMe(req.user.id);
  res.json({ user });
};
