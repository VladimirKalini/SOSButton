// src/routes/auth.js
router.post('/register', async (req, res) => {
  const { phone, password } = req.body;
  // валидация, хеширование пароля, сохранение в БД
  res.status(201).send({ message: 'OK' });
});
