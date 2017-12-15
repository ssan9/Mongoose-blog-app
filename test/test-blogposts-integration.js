'use strict';

const chai = require('chai');
const chaiHttp = require ('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout 
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for title, content, author
// and then we insert that data into mongo
function seedBlogPostData() {
	console.info('seeding blogpost data');
	const seedData = [];

	for (let i=1; i<=10; i++) {
		seedData.push(generateBlogPostData());
	}
	// this will return a promise
	return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
function generateTitleName() {
	const titles = [
		'I am', 'You are', 'They are', 'They were', 'Where were'];
	return titles[Math.floor(Math.random() * titles.length)];
}

// used to generate data to put in db
function generateContentName() {
	const contents = ["Mr. Bean is Mr.Toad's Brother", "Mr. Toad is Mr. Pea's Brother", "Mr. Pea has two Brothers"];
	return contents[Math.floor(Math.random() * contents.length)];
}

// generate an object representing a blogpost.
// can be used to generate seed data for db
// or request.body data
function generateBlogPostData() {
	return{
		title: generateTitleName(),
		content: generateContentName(),
		author: {
			firstName: faker.name.firstName(),
			lastName: faker.name.lastName()
		},
	};
}

// this function deletes the entire database.
// we'll call it in 'afterEach' block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
	console.warn('Deleting database');
	return mongoose.connection.dropDatabase();
}

describe('Blogposts API resource', function() {

   // we need each of these hook functions to return a promise
   // otherwise we'd need to call a `done` callback. `runServer`,
   // `seedBlogPostData` and `tearDownDb` each return a promise 
   // so we return the value returned by these function calls.
   before(function() {
   		return runServer(TEST_DATABASE_URL);
   });

   beforeEach(function() {
   	return seedBlogPostData();
   });

   afterEach(function() {
   	return tearDownDb();
   });

   after(function() {
   	return closeServer();
   });

   // note the use of nested `describe` blocks.
   // this allows us to make clearer, more discrete tests that focus
   // on proving something small
   describe('GET endpoint', function() {

   	 it('should return all existing posts', function() {
   		// strategy:
   		// 	  1. get back all blogposts returned by GET request to `/blogposts`
   		// 	  2. prove res has right status, data type
   		// 	  3. prove the number of blogposts we got back is equal to number
   		//		 in db.

   		// need to have access to mutate and access `res` across
   		// `.then()` calls below, so declare it here so can modify in place
   		let res;
   		return chai.request(app)
   			.get('/posts')
   			.then(function(_res) {
   				// so subsequent .then blocks can access resp obj.
   				res = _res;
               res.should.have.status(200);
               // console.log(res.body)
   				// otherwise our db seeding didnt't work
   				res.body.should.have.length.of.at.least(1);
   				return BlogPost.count();
   			})
   			.then(function(count) {
   				res.body.should.have.length(count);
               // initially it was- 
               // res.body.should.have.length.of(count);
               //remove .of from this line of code because it's not 
               // a function doesn't end with 'of'

   			});
   		 });

   	  it('should return posts with right fields', function() {
   	  	// strategy: Get back all blogposts, and ensure they have expected keys

   	  	let resBlogPost;
   	  	return chai.request(app)
   	  		.get('/posts')
   	  		.then(function(res) {
   	  			res.should.have.status(200);
   	  			res.should.be.json;
   	  			res.body.should.be.an('array');
   	  			res.body.should.have.length.of.at.least(1);

   	  			res.body.forEach(function(post) {
   	  				post.should.be.an('object');
   	  				post.should.include.keys(
   	  					'id', 'title', 'content', 'author');
   	  			});
   	  			resBlogPost = res.body[0];
   	  			return BlogPost.findById(resBlogPost.id);
   	  		})
   	  		.then(function(post) {

   	  			resBlogPost.id.should.equal(post.id);
   	  			resBlogPost.title.should.equal(post.title);
   	  			resBlogPost.content.should.equal(post.content);
   	  			resBlogPost.author.should.equal(post.authorName);

   	  		});
   	  });
   });

   describe('POST endpoint', function() {
   	  // strategy: make a POST request with data,
   	  // then prove that the post we get back has
   	  // right keys, and that `id` is there (which means
   	  // the data was inserted into db)
   	  it('should add a new post', function() {

   	  	const newBlogPost = generateBlogPostData();

   	  	return chai.request(app)
   	  	  .post('/posts')
   	  	  .send(newBlogPost)
   	  	  .then(function(res) {
   	  	  	res.should.have.status(201);
   	  	  	res.should.be.json;
   	  	  	res.body.should.be.an('object');
   	  	  	res.body.should.include.keys(
   	  	  		'id', 'title', 'content', 'author');
   	  	  	res.body.title.should.equal(newBlogPost.title);
   	  	  	// cause Mongo should  have created id on insertion
   	  	  	res.body.id.should.not.be.null;
   	  	  	res.body.content.should.equal(newBlogPost.content);
   	  	  	res.body.author.should.equal(newBlogPost.author.firstName+' '+newBlogPost.author.lastName);
            // res.body.author.should.equal(newBlogPost.author.lastName);

   	  	  	return BlogPost.findById(res.body.id);
   	  	  })
   	  	  .then(function(post) {
   	  	  	post.title.should.equal(newBlogPost.title);
   	  	  	post.content.should.equal(newBlogPost.content);
   	  	  	post.authorName.should.equal(newBlogPost.author.firstName+' '+newBlogPost.author.lastName);
            // authorName instead of author because post is our object in models.js with
            // authorName Schema
   	  	  });
   	  });
   });

   describe('PUT endpoint', function() {

   		// strategy:
   		// 	 1. Get an existing post from db
   		//	 2. Make a PUT request to update that post
   		//	 3. Prove post returned by request contains data we sent
   		//	 4. Prove post in db is correctly updated
   		it('should update fields you send over', function() {
   			const updateData = {
   				title: 'yoyoyoyoyoyoyo',
   				content: 'Who is Peanut Man?'
   			};

   			return BlogPost
   				.findOne()
   				.then(function(post) {
   					updateData.id = post.id;

   					// make request then inspect it to make sure it reflects
   					// data we sent
   					return  chai.request(app)
   						.put(`/posts/${post.id}`)
   						.send(updateData);
   				})
   				.then(function(res) {
   					res.should.have.status(204);

   					return BlogPost.findById(updateData.id);
   				})
   				.then(function(post) {
   					post.title.should.equal(updateData.title);
   					post.content.should.equal(updateData.content);
   				});
   		});
   });

   describe('DELETE endpoint', function() {
   	  // strategy:
   	  // 	1. get a post
   	  //	2. make a DELETE request for that post's id
   	  //	3. assert that response has right status code
   	  //	4. prove that post with the id doesn't exist in db anymore
   	  it('delete a restaurant by id', function() {

   	  	 let post;

   	  	 return BlogPost
   	  	 	.findOne()
   	  	 	.then(function(_post) {
   	  	 		post = _post;
   	  	 		return chai.request(app).delete(`/posts/${post.id}`);
			})
			.then(function(res) {
				res.should.have.status(204);
				return BlogPost.findById(post.id);
			})
			.then(function(_post) {
				// when a variable's value is null, chaining `should`
				// doesn't work. So `_post.should.be.null` would raise
				// an error. `should.be.null(_post)` is how we can 
				// make assertions about a null value.
				should.not.exist(_post);
			});
   	  });
   });
});