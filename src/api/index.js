const router = require('express').Router();

const Users = require('./users/router');
const Auth = require('./auth/router');
const FAQ = require('./faq/router');
const Reports = require('./reports/router');
const Chats = require('./chats/router');
const Settings = require('./settings/router');
const Broadcasts = require('./broadcasts/router');
const Notifications = require('./notifications/router');
const IssueTypes = require('./issue-types/router');
const Roles = require('./roles/router');
const Permissions = require('./permissions/router');

router.use(Auth);
router.use(Users);
router.use(FAQ);
router.use(Reports);
router.use(Chats);
router.use(Settings);
router.use(Broadcasts);
router.use('/notifications', Notifications);
router.use('/issue-types', IssueTypes);
router.use('/roles', Roles);
router.use('/permissions', Permissions);

module.exports = router;
