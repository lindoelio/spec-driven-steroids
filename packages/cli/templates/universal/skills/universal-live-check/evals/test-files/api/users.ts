import { Router } from 'express';
import { db } from '../db';
import { body, validationResult } from 'express-validator';

const router = Router();

router.post('/users',
  body('email').isEmail().withMessage('Invalid email'),
  body('name').isLength({ min: 1 }).withMessage('Name is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, password } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await db.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, name, hashedPassword]
      );
      res.status(201).json(user.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
