// Backend tests for /api/items — THIS is the only backend file you edit.
// Run with:  npm test --workspace server
//
// tests/setup.js already starts an in-memory MongoDB and empties it after
// every test, so each test starts from a clean database.
import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
// Use different names/emails when you need two users (e.g. for the 403 test).
async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

// Helper: creates an item as the user owning `token` and returns it.
// Override any field: createItem(token, { title: 'Keys', status: 'found' })
async function createItem(token, body = {}) {
  const res = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library', ...body });
  return res.body.item;
}

describe('/api/items', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // `async` lets this test wait for each HTTP request before moving on.
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // Arrange: register one user and keep the JWT needed for authenticated requests.
    const token = await registerAndGetToken('Alice', 'duplicate@test.com');
    // These values identify the report whose duplicate should be rejected.
    const report = { title: 'Danny Phantom', location: 'Amity Park' };

    // Act: send the first report; it creates the item and establishes the duplicate.
    const firstResponse = await request(app)
      .post('/api/items') // `post` makes an HTTP POST request to the item collection.
      .set('Authorization', `Bearer ${token}`) // Send the JWT in the standard auth header.
      .send({ ...report, status: 'lost', category: 'other' }); // JSON body; spread copies title/location.

    // Assert: the initial report is accepted, so the second request has a real duplicate to match.
    expect(firstResponse.status).toBe(201);

    // Act: submit the same title and location again with the same user's credentials to create the duplicate response.
    const duplicateResponse = await request(app)
      .post('/api/items') //Use the same endpoint to submit the duplicate report.
      .set('Authorization', `Bearer ${token}`) // Authenticate this request as the same one as before
      .send({ ...report, status: 'found', category: 'other' }); // Title and location remain the same but the rest are changed

    //We expect cause it's a duplicate that the request status to be 409
    expect(duplicateResponse.status).toBe(409);
  });

  // This checks the authorization boundary for edits by a different registered user.
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // Create two accounts with distinct emails so they receive distinct identities.
    const reporterToken = await registerAndGetToken('Alice', 'reporter@test.com');
    const DannyToken = await registerAndGetToken('Bob', 'other-user@test.com');
    // Create the item under the reporter's identity; the helper returns its saved database record.
    const item = await createItem(reporterToken);

    // Attempt to change the item's title while authenticating as the other user.
    const response = await request(app)
      .patch(`/api/items/${item._id}`) // The item ID selects which existing item receives the update.
      .set('Authorization', `Bearer ${DannyToken}`) // This JWT belongs to Danny Phantom, the ghost here.
      .send({ title: 'Inviso-Bill' }); // PATCH sends only the field we want to update.

    // The server rejects a validly authenticated user who does not own the item but tried to butt in and change what isn't his.
    expect(response.status).toBe(403);
  });
});
