router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Kiểm tra nếu đã đăng nhập thì không xử lý tiếp
        if (req.session.user) {
            return res.redirect('/admin');
        }
        
        const user = await User.findOne({ username });
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            return res.redirect('/admin');
        } else {
            return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.render('login', { error: 'Có lỗi xảy ra, vui lòng thử lại' });
    }
});