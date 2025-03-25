const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { isAdmin } = require('../middleware/auth');

// Hiển thị danh sách users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users', {
      users,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    req.flash('error', 'Không thể lấy danh sách người dùng');
    res.render('admin/users', {
      users: [],
      error: 'Không thể lấy danh sách người dùng'
    });
  }
});

// Tạo user mới
router.post('/users', isAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const user = new User({ username, email, password, role });
    await user.save();
    req.flash('success', 'Tạo người dùng thành công');
    res.redirect('/admin/users');
  } catch (error) {
    req.flash('error', 'Không thể tạo người dùng');
    res.redirect('/admin/users');
  }
});

// Xóa user
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Không thể xóa người dùng' });
  }
});

module.exports = router;