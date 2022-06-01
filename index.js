const express = require("express");
const hbs = require("hbs");
const { postgress} = require("./connection/db.js");
const { body, validationResult, oneOf, check } = require("express-validator");
const multer = require("multer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require('express-flash');
const { redirect } = require("express/lib/response");
// const { redirect, render, type } = require("express/lib/response");
// const async = require("hbs/lib/async");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/image/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".jpg"); //Appending .jpg
  },
});
const upload = multer({ storage });
const app = express();
const PORT = 80;
const month = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

app.set("view engine", "hbs");
app.use("/public", express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: 'rahasia',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 6 },
  })
);

app.get("/", async (req, res) => {
  const query=req.session.isLogin===true ? `SELECT * from tb_project where id_user=${req.session.user.id}`:"SELECT * from tb_project";
  console.log(query);
  res.render("index", {
    listProject: await postgress(query),
    login:req.session.isLogin,
    user:req.session.user
  });
});

app.get("/login", (req, res) => {
  if(req.session.isLogin){
    res.redirect('/');
  }
  res.render("login");
});

app.post(
  "/login",
  body("email")
    .notEmpty()
    .withMessage("the email is required")
    .isEmail()
    .withMessage("wrong email format")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("the password is required")
    .isLength({ min: 8 })
    .withMessage("must be at least 8 chars long"),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      req.flash('error',validationResult(req).array());
      return res.render('login');
    }
    const user = await postgress(
      `SELECT * FROM users WHERE email='${req.body.email}'`
    );

    if(user.length === 0){
      req.flash('err', `email not found in our record`);
      return res.redirect('/login');
    }

    if(bcrypt.compareSync(req.body.password, user[0].password) === false){
      req.flash('err', `password not match with our record`);
     return res.redirect('/login');
    }

      req.session.isLogin = true;
      req.session.user = {
        id: user[0].id,
        email: user[0].email,
        name: user[0].username,
      };
    req.flash('scc', `Welcome, ${user[0].email}`);
    res.redirect('/');
  }
);


app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get("/register", (req, res) => {
  if(req.session.isLogin){
    res.redirect('/');
  }
  res.render("register");
});

app.post(
  "/register",
  body("username")
    .notEmpty()
    .withMessage("the username is required")
    .isString()
    .withMessage("username must be string"),
  body("email")
    .notEmpty()
    .withMessage("the email is required")
    .isEmail()
    .withMessage("wrong email format")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("the password is required")
    .isLength({ min: 8 })
    .withMessage("must be at least 8 chars long"),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      req.flash('err',validationResult(req).array().msg);
      return res.redirect('/login');
    }
  const hash = bcrypt.hashSync(req.body.password, 10);
  const data=await postgress(
      `insert into users(username,email,password) values('${req.body.username}','${req.body.email}','${hash}') RETURNING *;`
    );
     
    req.session.isLogin = true;
    req.session.user = {
      id: data[0].id,
      email: data[0].email,
      name: data[0].username,
    };

    req.flash('scc', `Welcome, ${data[0].email}`);
    res.redirect("/");
  }
);

const isLogin=()=>{
  return(req, res, next) =>{
  if(typeof req.session.isLogin === "undefined"){
      return res.redirect('/');
    }
    next()
  }
}

app.get("/project/add",isLogin(), (req, res) => {
  res.render("project",{
    login:req.session.isLogin,
    user:req.session.user
  });
});

app.post(
  "/project/add",
  isLogin(),
  upload.single("image"),
  body('name').notEmpty().withMessage('field name required').isString().withMessage('field name must be string'),
  body('dateStart').notEmpty().withMessage('field date start required').isDate().withMessage('field date start must be date format'),
  body('dateEnd').notEmpty().withMessage('field date end required').isDate().withMessage('field date end must be date format').custom((value, { req }) => {
    if(new Date(value) <= new Date(req.body.dateStart)) {
        throw new Error ('End date of lab must be valid and after start date');
    }
    return true;
}),
  body('content').notEmpty().withMessage('field Description required').isString().withMessage('field Description must be string').trim(),
  body('checkbox').notEmpty().withMessage('field technologies required'),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      req.flash('err',validationResult(req).array());
      return res.redirect('/project/add');
    }
    const data = req.body;
    const checkbox =
      typeof data["checkbox"] == "object"
        ? JSON.stringify(data["checkbox"])
        : `["` + data["checkbox"] + `"]`;

    await postgress(
      `insert into tb_project(name,start_date,end_date,description,technologi,image,id_user)
   values('${data["name"]}','${data["dateStart"]}','${data["dateEnd"]}',
  '${data["content"]}','${checkbox}','${req.file.filename}',${req.session.user.id});`
    );
    res.redirect("/");
  }
);

app.get("/project/delete/:id",isLogin(), async (req, res) => {
  await postgress(`delete FROM tb_project WHERE id=${req.params.id}`);

  res.redirect("/");
});

app.get("/project/edit/:id",isLogin(), async (req, res) => {

  const data = await postgress(
    `SELECT * FROM tb_project WHERE id=${req.params.id}`
  );

  if(req.session.user.id !== data[0].id_user){
    return  res.redirect('/');
  }
  res.render("project", { edit: data[0] });
});

app.post("/project/update/:id",
isLogin(),
 upload.single("image"),
 body('name').notEmpty().withMessage('field name required').isString().withMessage('field name must be string'),
  body('dateStart').notEmpty().withMessage('field date start required').isDate().withMessage('field date start must be date format'),
  body('dateEnd').notEmpty().withMessage('field date end required').isDate().withMessage('field date end must be date format').custom((value, { req }) => {
    if(new Date(value) <= new Date(req.body.dateStart)) {
        throw new Error ('End date of lab must be valid and after start date');
    }
    return true;
}),
  body('content').notEmpty().withMessage('field Description required').isString().withMessage('field Description must be string').trim(),
  body('checkbox').notEmpty().withMessage('field technologies required'),
 async (req, res) => {
  if (!validationResult(req).isEmpty()) {
    req.flash('err',validationResult(req).array());
    console.log(validationResult(req).array());
    return res.redirect(`/project/edit/${req.body.params.id}`);
  }
  const data = req.body;
  const checkbox =
    typeof data["checkbox"] == "object"
      ? JSON.stringify(data["checkbox"])
      : `["` + data["checkbox"] + `"]`;
  const image =
    typeof req.file == "undefined" ? "" : `,image='${req.file.filename}'`;

  await postgress(
    `UPDATE tb_project SET name='${data["name"]}',start_date='${data["dateStart"]}',
   end_date='${data["dateEnd"]}',description='${data["content"]}',
   technologi='${checkbox}' ${image}
   WHERE id=${req.params.id};`
  );
  res.redirect("/");
});

app.get("/project/:id", async (req, res) => {
  const data = await postgress(
    `SELECT * FROM tb_project WHERE id=${req.params.id}`
  );


  res.render("project-detail", {
    project: data[0],
    login:req.session.isLogin,
    user:req.session.user });
});

app.get("/contact", (req, res) => {
  res.render("contact",{
    login:req.session.isLogin,
    user:req.session.user
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});

hbs.registerHelper("fulltime", function () {
  return getFullTime(this.project.start_date, this.project.end_date);
});

hbs.registerHelper("duration", function (project = false) {
  if (project == true) {
    this.start_date = this.project.start_date;
    this.end_date = this.project.end_date;
  }
  return difference(this.start_date, this.end_date);
});

hbs.registerHelper("editChekbox", function (param) {
  const check = ["reactjs", "android", "github", "gatsby", "flutter", "vuejs"];
  const label = [
    "React Js",
    "Android",
    "Github",
    "Gatsby",
    "Flutter",
    "Vue Js",
  ];
  const checked = JSON.parse(this.edit.technologi);
  let a = "";
  check.forEach((element, index) => {
    // console.log(checked.find(e => e==element) == undefined);
    a += ` <div class="form-check">
              <input class="form-check-input" type="checkbox" name="checkbox[]" value='${element}' id="defaultCheck1" ${
      checked.find((e) => e === element) !== undefined ? "checked" : ""
    }/>
                <label class="form-check-label" for="defaultCheck1">
                ${label[index]}
              </label>
            </div>`;
  });
  return a;
});

hbs.registerHelper("date", function (time) {
  time = new Date(time);
  return `${time.getFullYear()}-${time.getMonth() + 1 > 9 ? time.getMonth() + 1 : "0" + (time.getMonth() + 1)}-${time.getDate()}`;
});

hbs.registerHelper("tecnologisIcon", function (project = false) {
  // console.log();
  if (project === true) {
    this.technologi = this.project.technologi;
  }
  let a = "";
  if (project === true) {
    JSON.parse(this.technologi).forEach((element) => {
      a += `<span class="d-flex" style="gap:5px;"><li class="ri-${element}-line ri-xl"></li> ${element}</span>`;
    });
  } else {
    JSON.parse(this.technologi).forEach((element) => {
      a += `<li class="ri-${element}-line ri-xl"></li>`;
    });
  }
  return a;
});

function difference(date1, date2) {
  date1 = new Date(date1);
  date2 = new Date(date2);
  const date1utc = Date.UTC(
    date1.getFullYear(),
    date1.getMonth(),
    date1.getDate()
  );
  const date2utc = Date.UTC(
    date2.getFullYear(),
    date2.getMonth(),
    date2.getDate()
  );
  day = 1000 * 60 * 60 * 24;
  dif = (date2utc - date1utc) / day;
  return dif < 30 ? dif + " hari" : parseInt(dif / 30) + " bulan";
}

function getFullTime(dateStart, dateEnd) {
  dateStart = new Date(dateStart);
  dateEnd = new Date(dateEnd);
  return `${dateStart.getDate()} ${
    month[dateStart.getMonth()]
  } ${dateStart.getFullYear()} - ${dateEnd.getDate()} ${
    month[dateEnd.getMonth()]
  } ${dateEnd.getFullYear()}`;
}
