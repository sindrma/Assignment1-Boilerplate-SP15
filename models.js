var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');


var userSchema = mongoose.Schema({
	"name" : { type: String },
	"username" : {type: String},
	"fb_id" : { type: String },
	"ig_id" : {type: String},
	"ig_prof_pic" : {type: String},
	"access_token_fb" : { type: String },
	"access_token_ig" : {type: String}
});

userSchema.plugin(findOrCreate);

exports.User = mongoose.model('User', userSchema);

