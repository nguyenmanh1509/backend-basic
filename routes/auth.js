router.get('/logout', (req, res) => {
    // Xóa session
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }
        // Xóa cookie
        res.clearCookie('connect.sid');
        // Chuyển hướng về trang chủ
        res.redirect('/');
    });
});