const path = require("node:path");
const {randomBytes, createHmac} = require("node:crypto");
const { ObjectId } = require("@fastify/mongodb");

// create fastify app
const fastifyApp = require("fastify")({ 
    logger: true, 
    disableRequestLogging: true 
});

// Register Plugins
fastifyApp.register(require("@fastify/mongodb"), {
    url: "mongodb://localhost:27017/truyendb"
});

fastifyApp.register(require("@fastify/jwt"), {
    secret: "asfjdjvdkbjkngdgbjkbjgnl"
});

fastifyApp.register(require("@fastify/cookie"), {
    secret: "djsbhvvdjkbvdnvidubvbbd",
    hook: "onRequest",
});

fastifyApp.register(require("@fastify/formbody"));

fastifyApp.register(require("@fastify/view"), {
    engine: {
        pug: require("pug")
    },
    root: "views",
    propertyName: "render",
    asyncPropertyName: "asyncRender",
});

fastifyApp.register(require("@fastify/static"), {
    root: path.join(__dirname, "public"),
    prefix: "/public/"
});

// Hook xác thực chung
fastifyApp.addHook('preHandler', async (request, reply) => {
    try {
        const token = request.cookies.token;
        if (token) {
            const decoded = await fastifyApp.jwt.verify(token);
            request.user = decoded;
        }
    } catch (err) {
        request.user = null;
    }
});

// Middleware kiểm tra admin
const checkAdmin = async (request, reply) => {
    if (!request.user || request.user.role !== 'admin') {
        return reply.redirect('/login');
    }
};

// User routes
fastifyApp.get("/users", async function (req, rep) {
    const users = await this.mongo.db.collection("users")
        .find({}, { projection: { password: 0 } })
        .toArray();
    return rep.render("users", { users, user: req.user });
});

fastifyApp.get("/create-user", function (req, rep) {
    rep.render("create-user", { user: req.user });
});

fastifyApp.post("/user", async function (req, rep) {
    const salt = randomBytes(16).toString("hex");
    const hpass = createHmac("sha256", salt)
        .update(req.body.password)
        .digest("hex");
    
    await this.mongo.db.collection("users").insertOne({
        username: req.body.username,
        role: req.body.role,
        salt,
        hpass
    });

    rep.redirect("/users");
});

// Auth routes
fastifyApp.get("/login", function (req, rep){
    if (req.user) {
        return rep.redirect('/admin');
    }
    rep.render("login");
});

fastifyApp.post("/login", async function (req, rep) {
    try {
        const user = await this.mongo.db.collection("users")
            .findOne({username: req.body.username});
        
        if(!user) {
            return rep.view("login", { error: "User not exist" });
        }

        const newHpass = createHmac("sha256", user.salt)
            .update(req.body.password)
            .digest("hex");
            
        if(newHpass === user.hpass){
            const token = await this.jwt.sign({
                username: user.username, 
                role: user.role,
                id: user._id
            });

            rep.setCookie('token', token, {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: true
            });

            if(user.role === 'admin') {
                return rep.redirect("/admin");
            }
            return rep.redirect("/");
        }
        return rep.view("login", { error: "Wrong password" });
    } catch (error) {
        console.error(error);
        return rep.view("login", { error: "Login error" });
    }
});

fastifyApp.get("/logout", async function (req, rep) {
    rep.clearCookie("token", {
        path: '/'
    });
    return rep.redirect("/");
});

// Routes cơ bản
fastifyApp.get("/", async function (req, rep) {
    try {
        const stories = await this.mongo.db.collection("truyen")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        return rep.render("index", { stories, user: req.user });
    } catch (error) {
        console.error('Error loading stories:', error);
        return rep.view("index", { error: "Error loading stories", user: req.user });
    }
});

fastifyApp.get("/index", async function (req, rep) {
    try {
        const stories = await this.mongo.db.collection("truyen")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        return rep.render("index", { stories, user: req.user });
    } catch (error) {
        console.error('Error loading stories:', error);
        return rep.view("index", { error: "Error loading stories", user: req.user });
    }
});

// Admin routes
fastifyApp.get("/admin", async function (req, rep) {
    await checkAdmin(req, rep);
    
    try {
        const stats = {
            totalUsers: await this.mongo.db.collection("users").countDocuments(),
            totalStories: await this.mongo.db.collection("truyen").countDocuments()
        };
        
        return rep.render("admin/admin", { stats, user: req.user });
    } catch (error) {
        console.error(error);
        return rep.view("admin/admin", { error: "Error loading admin dashboard" });
    }
});


// Admin story routes
fastifyApp.get("/admin/stories", async function (req, rep) {
    await checkAdmin(req, rep);
    
    try {
        const stories = await this.mongo.db.collection("truyen")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        
        console.log('Found stories:', stories); // Debug log

        const stats = {
            totalUsers: await this.mongo.db.collection("users").countDocuments(),
            totalStories: await this.mongo.db.collection("truyen").countDocuments()
        };
        
        return rep.render("admin/admin", { stories, stats, user: req.user });
    } catch (error) {
        console.error('Error loading stories:', error);
        return rep.view("admin/admin", { error: "Error loading stories" });
    }
});

fastifyApp.get("/admin/stories/create", async function (req, rep) {
    await checkAdmin(req, rep);
    return rep.render("admin/story-form", { user: req.user });
});

fastifyApp.post("/admin/stories", async function (req, rep) {
    await checkAdmin(req, rep);

    try {
        const storyData = {
            title: req.body.title,
            author: req.body.author,
            category: req.body.category,
            description: req.body.description,
            status: req.body.status || 'draft',
            coverImage: req.body.coverImage || '/public/image/no-image.png',
            createdAt: new Date(),
            updatedAt: new Date(),
            views: 0
        };

        console.log('Adding new story:', storyData); // Debug log

        await this.mongo.db.collection("truyen").insertOne(storyData);
        console.log('Story added successfully'); // Debug log

        return rep.redirect('/admin/stories');
    } catch (error) {
        console.error('Error creating story:', error);
        return rep.view("admin/story-form", { 
            error: "Error creating story",
            story: req.body 
        });
    }
});

fastifyApp.get("/admin/stories/edit/:id", async function (req, rep) {
    await checkAdmin(req, rep);
    
    try {
        const story = await this.mongo.db.collection("truyen")
            .findOne({ _id: new ObjectId(req.params.id) });
        return rep.render("admin/story-form", { story, user: req.user });
    } catch (error) {
        console.error('Error loading story for edit:', error);
        return rep.redirect('/admin/stories');
    }
});

fastifyApp.post("/admin/stories/:id", async function (req, rep) {
    await checkAdmin(req, rep);

    try {
        const updateData = {
            title: req.body.title,
            author: req.body.author,
            category: req.body.category,
            description: req.body.description,
            status: req.body.status,
            coverImage: req.body.coverImage,
            updatedAt: new Date()
        };

        await this.mongo.db.collection("truyen").updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
        );

        return rep.redirect('/admin/stories');
    } catch (error) {
        console.error('Error updating story:', error);
        return rep.view("admin/story-form", { 
            error: "Error updating story",
            story: { ...req.body, _id: req.params.id }
        });
    }
});

fastifyApp.delete("/admin/stories/:id", async function (req, rep) {
    await checkAdmin(req, rep);

    try {
        await this.mongo.db.collection("truyen")
            .deleteOne({ _id: new ObjectId(req.params.id) });
        return rep.send({ success: true });
    } catch (error) {
        console.error('Error deleting story:', error);
        return rep.status(500).send({ success: false });
    }
});

// Admin user routes
fastifyApp.get("/admin/users", async function (req, rep) {
    await checkAdmin(req, rep);
    
    try {
        const users = await this.mongo.db.collection("users")
            .find({}, { projection: { password: 0, salt: 0, hpass: 0 } })
            .sort({ createdAt: -1 })
            .toArray();
            
        const stats = {
            totalUsers: await this.mongo.db.collection("users").countDocuments(),
            totalStories: await this.mongo.db.collection("truyen").countDocuments()
        };
        
        return rep.render("admin/users", { users, stats, user: req.user });
    } catch (error) {
        console.error('Error loading users:', error);
        return rep.view("admin/users", { error: "Error loading users" });
    }
});


// Route để hiển thị form cập nhật thông tin người dùng
fastifyApp.get("/update-user/:id", async function (req, rep) {
    // Lấy thông tin người dùng từ cơ sở dữ liệu dựa trên ID
    const user = await this.mongo.db.collection("users").findOne({ _id: new ObjectId(req.params.id) });

    // Render file update-user.pug với dữ liệu người dùng
    return rep.render("update-user", { user });
});

// Route để cập nhật thông tin người dùng
fastifyApp.post("/user/:id", async function (req, rep) {
    // Lấy dữ liệu từ form
    const { username, role } = req.body;

    // Cập nhật thông tin người dùng vào cơ sở dữ liệu
    await this.mongo.db.collection("users").updateOne(
        { _id: new ObjectId(req.params.id) }, // Điều kiện tìm kiếm
        { 
            $set: { 
                username, 
                role 
            } // Thông tin cập nhật
        }
    );

    // Sau khi cập nhật thành công, chuyển hướng về trang danh sách người dùng
    return rep.redirect("/users");
});

// Route (get/user/:id) --> xóa người dùng
fastifyApp.get("/user/:id",  async function (req, rep) {
    const result = await this.mongo.db.collection("users").deleteOne(
        { _id: new ObjectId(req.params.id) }
    );
    rep.redirect("/users");
});
// Start server
fastifyApp.listen({ port: 3100 }, (err) => {
    if (err) {
        fastifyApp.log.error(err);      
        process.exit(1);
    }
    console.log('Server running at http://localhost:3100');
});