// @ts-nocheck

const API_URL = "https://gb-forums.user2l1x.workers.dev";

const state = {
  token: localStorage.getItem("gb_forums_token"),
  user: null,
  forums: [],
  posts: [],
  currentForum: null,
  currentPost: null,
  currentPage: 1,
  searchQuery: "",
  loading: false
};

document.addEventListener("DOMContentLoaded", initializeApp);

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  if (!date) return "Unknown date";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(date) {
  if (!date) return "Unknown date";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getInitials(name) {
  if (!name) return "?";

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function getElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}

function getElements(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setToken(token) {
  state.token = token;

  if (token) {
    localStorage.setItem("gb_forums_token", token);
  } else {
    localStorage.removeItem("gb_forums_token");
  }
}

function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";

    container.style.position = "fixed";
    container.style.right = "20px";
    container.style.bottom = "20px";
    container.style.zIndex = "99999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";

    document.body.appendChild(container);
  }

  const toast = document.createElement("div");

  toast.textContent = message;

  toast.style.padding = "13px 16px";
  toast.style.borderRadius = "12px";
  toast.style.background = "rgba(20, 20, 28, 0.96)";
  toast.style.color = "#fff";
  toast.style.border = "1px solid rgba(255,255,255,.12)";
  toast.style.boxShadow = "0 10px 30px rgba(0,0,0,.3)";
  toast.style.fontSize = "14px";
  toast.style.maxWidth = "360px";
  toast.style.backdropFilter = "blur(12px)";
  toast.style.transition = "opacity .2s ease, transform .2s ease";

  if (type === "success") {
    toast.style.borderColor = "rgba(98,230,167,.4)";
  }

  if (type === "error") {
    toast.style.borderColor = "rgba(242,124,124,.5)";
  }

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3500);
}

function openModal(modal) {
  if (!modal) return;

  modal.classList.add("active");
  modal.classList.add("open");

  modal.style.display = "flex";

  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove("active");
  modal.classList.remove("open");

  modal.style.display = "none";

  document.body.classList.remove("modal-open");
}

function closeAllModals() {
  getElements(
    ".modal, [role='dialog'], #login-modal, #register-modal, #profile-modal, #post-create-modal, #post-modal"
  ).forEach(closeModal);
}

async function api(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    console.error("Network error:", error);
    throw new Error(
      "Could not connect to the forum server."
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed (${response.status})`;

    if (response.status === 401) {
      setToken(null);
      state.user = null;
      renderAuthState();
    }

    throw new Error(message);
  }

  return data;
}

async function checkHealth() {
  try {
    const result = await api("/api/health");

    if (result?.database === false) {
      showToast(
        "The forum server is online, but the database is unavailable.",
        "error"
      );
    }

    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function loadCurrentUser() {
  if (!state.token) {
    state.user = null;
    renderAuthState();
    return null;
  }

  try {
    const result = await api("/api/me");

    state.user = result.user || result;

    renderAuthState();

    return state.user;
  } catch (error) {
    setToken(null);
    state.user = null;
    renderAuthState();

    return null;
  }
}

function renderAuthState() {
  const loggedIn = Boolean(state.user);

  getElements(".logged-in").forEach(element => {
    element.style.display = loggedIn ? "" : "none";
  });

  getElements(".logged-out").forEach(element => {
    element.style.display = loggedIn ? "none" : "";
  });

  getElements(".current-username").forEach(element => {
    element.textContent =
      state.user?.username ||
      state.user?.display_name ||
      "Guest";
  });

  getElements(".current-display-name").forEach(element => {
    element.textContent =
      state.user?.display_name ||
      state.user?.username ||
      "Guest";
  });

  getElements(".current-avatar").forEach(element => {
    const name =
      state.user?.display_name ||
      state.user?.username ||
      "Guest";

    element.textContent = getInitials(name);
  });

  const newPostButton = getElement(
    "#new-post-button",
    "#create-post-button"
  );

  if (newPostButton) {
    newPostButton.style.display = loggedIn ? "" : "none";
  }

  const profileButton = getElement("#profile-button");

  if (profileButton) {
    profileButton.style.display = loggedIn ? "" : "none";
  }

  const logoutButton = getElement("#logout-button");

  if (logoutButton) {
    logoutButton.style.display = loggedIn ? "" : "none";
  }

  const loginButton = getElement("#login-button");

  if (loginButton) {
    loginButton.style.display = loggedIn ? "none" : "";
  }

  const registerButton = getElement("#register-button");

  if (registerButton) {
    registerButton.style.display = loggedIn ? "none" : "";
  }
}

async function loadForums() {
  try {
    const result = await api("/api/forums");

    state.forums = Array.isArray(result)
      ? result
      : result.forums || [];

    renderForums();
    populateForumSelect();

    return state.forums;
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");

    return [];
  }
}

function renderForums() {
  const container = getElement(
    "#forum-list",
    "#forums-list"
  );

  if (!container) return;

  container.innerHTML = "";

  const allItem = document.createElement("button");

  allItem.type = "button";
  allItem.className = "forum-item";

  if (!state.currentForum) {
    allItem.classList.add("active");
  }

  allItem.innerHTML = `
    <span class="forum-icon">⌂</span>
    <span>
      <strong>All Posts</strong>
      <small>Everything</small>
    </span>
  `;

  allItem.addEventListener("click", () => {
    state.currentForum = null;
    state.currentPage = 1;
    state.searchQuery = "";

    renderForums();
    updatePageTitle("All Posts");
    loadPosts();
  });

  container.appendChild(allItem);

  state.forums.forEach(forum => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "forum-item";

    if (state.currentForum === forum.id) {
      item.classList.add("active");
    }

    item.innerHTML = `
      <span class="forum-icon">#</span>
      <span>
        <strong>${escapeHTML(forum.name)}</strong>
        <small>${escapeHTML(forum.description || "")}</small>
      </span>
    `;

    item.addEventListener("click", () => {
      state.currentForum = forum.id;
      state.currentPage = 1;
      state.searchQuery = "";

      renderForums();

      updatePageTitle(forum.name);

      loadPosts();
    });

    container.appendChild(item);
  });
}

function populateForumSelect() {
  const select = getElement("#post-forum");

  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Choose a forum</option>
  `;

  state.forums.forEach(forum => {
    const option = document.createElement("option");

    option.value = forum.id;
    option.textContent = forum.name;

    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

async function loadPosts() {
  if (state.loading) return;

  state.loading = true;

  try {
    let path = `/api/posts?page=${state.currentPage}&limit=20`;

    if (state.currentForum) {
      path += `&forum=${encodeURIComponent(
        state.currentForum
      )}`;
    }

    const result = await api(path);

    state.posts = Array.isArray(result)
      ? result
      : result.posts || [];

    renderPosts(result);
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");

    renderPosts({
      posts: [],
      total: 0,
      page: state.currentPage,
      limit: 20
    });
  } finally {
    state.loading = false;
  }
}

function getPostAuthor(post) {
  return (
    post.author ||
    post.author_username ||
    post.username ||
    "Unknown User"
  );
}

function getPostForum(post) {
  return (
    post.forum_name ||
    post.forum ||
    "General"
  );
}

function renderPosts(result) {
  const container = getElement(
    "#posts-list",
    "#post-list",
    "#posts"
  );

  if (!container) return;

  const posts = Array.isArray(result)
    ? result
    : result.posts || [];

  container.innerHTML = "";

  if (!posts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <h3>No posts yet</h3>
        <p>
          ${state.searchQuery
            ? "No posts matched your search."
            : "Be the first person to start a conversation."}
        </p>
      </div>
    `;

    updatePagination(result);

    return;
  }

  posts.forEach(post => {
    container.appendChild(createPostElement(post));
  });

  updatePagination(result);
}

function createPostElement(post) {
  const article = document.createElement("article");

  article.className = "post-card";

  article.dataset.postId = post.id || "";

  const author = getPostAuthor(post);

  const title = post.title || "Untitled Post";

  const content = post.content || "";

  const preview =
    content.length > 240
      ? `${content.slice(0, 240)}...`
      : content;

  article.innerHTML = `
    <div class="post-card-header">
      <div class="post-author">
        <div class="avatar">
          ${escapeHTML(getInitials(author))}
        </div>

        <div>
          <strong>${escapeHTML(author)}</strong>
          <span>${escapeHTML(
            formatDate(post.created_at)
          )}</span>
        </div>
      </div>

      <span class="post-forum">
        ${escapeHTML(getPostForum(post))}
      </span>
    </div>

    <div class="post-card-body">
      <h3>${escapeHTML(title)}</h3>

      <p>${escapeHTML(preview)}</p>
    </div>

    <div class="post-card-footer">
      <span>
        ${Number(post.reply_count || post.replies_count || 0)}
        replies
      </span>

      <span>Read discussion →</span>
    </div>
  `;

  article.addEventListener("click", () => {
    openPost(post.id);
  });

  return article;
}

function updatePagination(result) {
  const previous = getElement(
    "#previous-page",
    "#prev-page"
  );

  const next = getElement(
    "#next-page"
  );

  const page =
    Number(result?.page) ||
    state.currentPage;

  const limit =
    Number(result?.limit) ||
    20;

  const total =
    Number(result?.total) ||
    state.posts.length;

  const totalPages =
    total > 0
      ? Math.ceil(total / limit)
      : 1;

  if (previous) {
    previous.disabled = page <= 1;

    previous.style.opacity =
      page <= 1 ? "0.5" : "1";
  }

  if (next) {
    next.disabled = page >= totalPages;

    next.style.opacity =
      page >= totalPages ? "0.5" : "1";
  }

  const pageIndicator = getElement(
    "#page-number",
    ".page-number"
  );

  if (pageIndicator) {
    pageIndicator.textContent =
      `Page ${page} of ${totalPages}`;
  }
}

function updatePageTitle(title) {
  const element = getElement("#page-title");

  if (element) {
    element.textContent = title;
  }
}

async function openPost(postId) {
  if (!postId) return;

  try {
    const result = await api(
      `/api/posts/${encodeURIComponent(postId)}`
    );

    state.currentPost =
      result.post ||
      result;

    await renderPostModal(
      state.currentPost
    );
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function renderPostModal(post) {
  const modal = getElement("#post-modal");

  if (!modal) return;

  const title = getElement(
    "#modal-post-title"
  );

  const content = getElement(
    "#modal-post-content"
  );

  const meta = getElement(
    "#modal-post-meta"
  );

  if (title) {
    title.textContent =
      post.title || "Untitled Post";
  }

  if (content) {
    content.textContent =
      post.content || "";
  }

  if (meta) {
    const author = getPostAuthor(post);

    meta.textContent =
      `${author} · ${formatDateTime(
        post.created_at
      )}`;
  }

  const deleteButton = getElement(
    "#delete-post-button"
  );

  if (deleteButton) {
    const authorId =
      post.author_id ||
      post.author?.id;

    deleteButton.style.display =
      state.user &&
      (
        authorId === state.user.id ||
        getPostAuthor(post) === state.user.username
      )
        ? ""
        : "none";
  }

  await loadReplies(post.id);

  openModal(modal);
}

async function loadReplies(postId) {
  const container = getElement(
    "#replies-list",
    "#replies"
  );

  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      Loading replies...
    </div>
  `;

  try {
    const result = await api(
      `/api/posts/${encodeURIComponent(postId)}/replies`
    );

    const replies = Array.isArray(result)
      ? result
      : result.replies || [];

    renderReplies(replies);
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        Unable to load replies.
      </div>
    `;
  }
}

function renderReplies(replies) {
  const container = getElement(
    "#replies-list",
    "#replies"
  );

  if (!container) return;

  container.innerHTML = "";

  if (!replies.length) {
    container.innerHTML = `
      <div class="empty-state">
        No replies yet.
      </div>
    `;

    return;
  }

  replies.forEach(reply => {
    const author =
      reply.author ||
      reply.author_username ||
      reply.username ||
      "Unknown User";

    const element =
      document.createElement("div");

    element.className = "reply";

    element.innerHTML = `
      <div class="reply-author">
        <div class="avatar">
          ${escapeHTML(getInitials(author))}
        </div>

        <div>
          <strong>${escapeHTML(author)}</strong>
          <span>
            ${escapeHTML(
              formatDateTime(reply.created_at)
            )}
          </span>
        </div>
      </div>

      <div class="reply-content">
        ${escapeHTML(reply.content || "")}
      </div>
    `;

    container.appendChild(element);
  });
}

async function deleteCurrentPost() {
  if (!state.currentPost?.id) return;

  const confirmed =
    window.confirm(
      "Are you sure you want to delete this post?"
    );

  if (!confirmed) return;

  try {
    await api(
      `/api/posts/${encodeURIComponent(
        state.currentPost.id
      )}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "Post deleted successfully.",
      "success"
    );

    closeAllModals();

    state.currentPost = null;

    await loadPosts();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function login(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const loginValue =
    form.querySelector(
      "[name='login'], [name='username'], [name='email']"
    )?.value.trim();

  const password =
    form.querySelector(
      "[name='password']"
    )?.value;

  if (!loginValue || !password) {
    showToast(
      "Enter your username/email and password.",
      "error"
    );

    return;
  }

  const submitButton =
    form.querySelector(
      "button[type='submit']"
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await api(
      "/api/login",
      {
        method: "POST",
        body: JSON.stringify({
          login: loginValue,
          username: loginValue,
          email: loginValue,
          password
        })
      }
    );

    if (!result.token) {
      throw new Error(
        "The server did not return a session token."
      );
    }

    setToken(result.token);

    state.user =
      result.user ||
      null;

    if (!state.user) {
      await loadCurrentUser();
    } else {
      renderAuthState();
    }

    closeAllModals();

    form.reset();

    showToast(
      "Welcome back!",
      "success"
    );

    await loadPosts();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function register(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const username =
    form.querySelector(
      "[name='username']"
    )?.value.trim();

  const email =
    form.querySelector(
      "[name='email']"
    )?.value.trim();

  const password =
    form.querySelector(
      "[name='password']"
    )?.value;

  const displayName =
    form.querySelector(
      "[name='display_name']"
    )?.value.trim();

  if (!username || !email || !password) {
    showToast(
      "Fill in all required fields.",
      "error"
    );

    return;
  }

  const submitButton =
    form.querySelector(
      "button[type='submit']"
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await api(
      "/api/register",
      {
        method: "POST",
        body: JSON.stringify({
          username,
          email,
          password,
          display_name:
            displayName || username
        })
      }
    );

    if (result.token) {
      setToken(result.token);

      state.user =
        result.user ||
        null;

      if (!state.user) {
        await loadCurrentUser();
      } else {
        renderAuthState();
      }
    }

    closeAllModals();

    form.reset();

    showToast(
      "Account created successfully!",
      "success"
    );

    await loadPosts();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function logout() {
  try {
    if (state.token) {
      await api(
        "/api/logout",
        {
          method: "POST"
        }
      );
    }
  } catch (error) {
    console.error(error);
  }

  setToken(null);

  state.user = null;

  renderAuthState();

  showToast(
    "You have been logged out.",
    "success"
  );

  await loadPosts();
}

async function loadProfileIntoForm() {
  if (!state.user) return;

  const form = getElement(
    "#profile-form"
  );

  if (!form) return;

  const displayName =
    form.querySelector(
      "[name='display_name']"
    );

  const bio =
    form.querySelector(
      "[name='bio']"
    );

  if (displayName) {
    displayName.value =
      state.user.display_name ||
      state.user.username ||
      "";
  }

  if (bio) {
    bio.value =
      state.user.bio || "";
  }
}

async function updateProfile(event) {
  event.preventDefault();

  if (!state.user) {
    showToast(
      "You must be logged in.",
      "error"
    );

    return;
  }

  const form = event.currentTarget;

  const displayName =
    form.querySelector(
      "[name='display_name']"
    )?.value.trim();

  const bio =
    form.querySelector(
      "[name='bio']"
    )?.value;

  try {
    const result = await api(
      "/api/profile",
      {
        method: "PUT",
        body: JSON.stringify({
          display_name: displayName,
          bio: bio || ""
        })
      }
    );

    state.user =
      result.user ||
      result;

    renderAuthState();

    closeAllModals();

    showToast(
      "Profile updated.",
      "success"
    );
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function createPost(event) {
  event.preventDefault();

  if (!state.user) {
    showToast(
      "Log in before creating a post.",
      "error"
    );

    return;
  }

  const form = event.currentTarget;

  const title =
    form.querySelector(
      "[name='title']"
    )?.value.trim();

  const content =
    form.querySelector(
      "[name='content']"
    )?.value.trim();

  const forumId =
    form.querySelector(
      "[name='forum_id']"
    )?.value;

  if (!title || !content || !forumId) {
    showToast(
      "Choose a forum and fill in the title and content.",
      "error"
    );

    return;
  }

  const submitButton =
    form.querySelector(
      "button[type='submit']"
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    await api(
      "/api/posts",
      {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          forum_id: forumId
        })
      }
    );

    form.reset();

    closeAllModals();

    showToast(
      "Post published!",
      "success"
    );

    state.currentForum = forumId;
    state.currentPage = 1;

    renderForums();

    const forum =
      state.forums.find(
        item => item.id === forumId
      );

    updatePageTitle(
      forum?.name ||
      "Forum"
    );

    await loadPosts();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function submitReply(event) {
  event.preventDefault();

  if (!state.user) {
    showToast(
      "Log in to reply.",
      "error"
    );

    return;
  }

  if (!state.currentPost?.id) {
    showToast(
      "No post is currently open.",
      "error"
    );

    return;
  }

  const form = event.currentTarget;

  const content =
    form.querySelector(
      "[name='content']"
    )?.value.trim();

  if (!content) {
    showToast(
      "Write something before replying.",
      "error"
    );

    return;
  }

  const submitButton =
    form.querySelector(
      "button[type='submit']"
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    await api(
      `/api/posts/${encodeURIComponent(
        state.currentPost.id
      )}/replies`,
      {
        method: "POST",
        body: JSON.stringify({
          content
        })
      }
    );

    form.reset();

    showToast(
      "Reply posted!",
      "success"
    );

    await loadReplies(
      state.currentPost.id
    );
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function searchPosts(event) {
  if (event) {
    event.preventDefault();
  }

  const form =
    event?.currentTarget ||
    getElement(
      "#search-form",
      ".search-form"
    );

  const input =
    form?.querySelector(
      "input[name='q']"
    ) ||
    getElement(
      "#search-input",
      ".search-input"
    );

  const query =
    input?.value.trim() ||
    "";

  if (!query) {
    state.searchQuery = "";
    state.currentPage = 1;

    updatePageTitle(
      state.currentForum
        ? getForumName(state.currentForum)
        : "All Posts"
    );

    await loadPosts();

    return;
  }

  state.searchQuery = query;

  try {
    const result = await api(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    const results =
      Array.isArray(result)
        ? result
        : result.posts ||
          result.results ||
          [];

    state.posts = results;

    renderPosts({
      posts: results,
      total: results.length,
      page: 1,
      limit: results.length || 20
    });

    updatePageTitle(
      `Search: ${query}`
    );
  } catch (error) {
    console.error(error);
    showToast(
      error.message,
      "error"
    );
  }
}

function getForumName(id) {
  const forum =
    state.forums.find(
      item => item.id === id
    );

  return forum?.name || "Forum";
}

function bindModalButtons() {
  getElements(
    "[data-close-modal]"
  ).forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const modal =
          button.closest(
            ".modal, [role='dialog']"
          );

        closeModal(modal);
      }
    );
  });

  getElements(
    ".modal, [role='dialog']"
  ).forEach(modal => {
    modal.addEventListener(
      "click",
      event => {
        if (event.target === modal) {
          closeModal(modal);
        }
      }
    );
  });
}

function bindAuthButtons() {
  const loginButton =
    getElement("#login-button");

  if (loginButton) {
    loginButton.addEventListener(
      "click",
      () => {
        closeAllModals();

        openModal(
          getElement("#login-modal")
        );
      }
    );
  }

  const registerButton =
    getElement("#register-button");

  if (registerButton) {
    registerButton.addEventListener(
      "click",
      () => {
        closeAllModals();

        openModal(
          getElement("#register-modal")
        );
      }
    );
  }

  const logoutButton =
    getElement("#logout-button");

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logout
    );
  }

  const profileButton =
    getElement("#profile-button");

  if (profileButton) {
    profileButton.addEventListener(
      "click",
      async () => {
        await loadProfileIntoForm();

        openModal(
          getElement("#profile-modal")
        );
      }
    );
  }

  const newPostButton =
    getElement(
      "#new-post-button",
      "#create-post-button"
    );

  if (newPostButton) {
    newPostButton.addEventListener(
      "click",
      () => {
        if (!state.user) {
          showToast(
            "Log in to create a post.",
            "error"
          );

          return;
        }

        populateForumSelect();

        openModal(
          getElement(
            "#post-create-modal"
          )
        );
      }
    );
  }
}

function bindForms() {
  const loginForm =
    getElement("#login-form");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      login
    );
  }

  const registerForm =
    getElement("#register-form");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      register
    );
  }

  const profileForm =
    getElement("#profile-form");

  if (profileForm) {
    profileForm.addEventListener(
      "submit",
      updateProfile
    );
  }

  const postForm =
    getElement("#post-form");

  if (postForm) {
    postForm.addEventListener(
      "submit",
      createPost
    );
  }

  const replyForm =
    getElement("#reply-form");

  if (replyForm) {
    replyForm.addEventListener(
      "submit",
      submitReply
    );
  }

  const searchForm =
    getElement(
      "#search-form",
      ".search-form"
    );

  if (searchForm) {
    searchForm.addEventListener(
      "submit",
      searchPosts
    );
  }
}

function bindNavigation() {
  const allPostsButton =
    getElement("#all-posts-button");

  if (allPostsButton) {
    allPostsButton.addEventListener(
      "click",
      async () => {
        state.currentForum = null;
        state.currentPage = 1;
        state.searchQuery = "";

        renderForums();

        updatePageTitle(
          "All Posts"
        );

        await loadPosts();
      }
    );
  }

  const previous =
    getElement(
      "#previous-page",
      "#prev-page"
    );

  if (previous) {
    previous.addEventListener(
      "click",
      async () => {
        if (state.currentPage <= 1) {
          return;
        }

        state.currentPage--;

        await loadPosts();
      }
    );
  }

  const next =
    getElement(
      "#next-page"
    );

  if (next) {
    next.addEventListener(
      "click",
      async () => {
        state.currentPage++;

        await loadPosts();
      }
    );
  }

  const clearSearch =
    getElement(
      "#clear-search"
    );

  if (clearSearch) {
    clearSearch.addEventListener(
      "click",
      async () => {
        const input =
          getElement(
            "#search-input",
            ".search-input"
          );

        if (input) {
          input.value = "";
        }

        state.searchQuery = "";
        state.currentPage = 1;

        updatePageTitle(
          state.currentForum
            ? getForumName(
                state.currentForum
              )
            : "All Posts"
        );

        await loadPosts();
      }
    );
  }
}

function bindKeyboardShortcuts() {
  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        closeAllModals();
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        const searchInput =
          getElement(
            "#search-input",
            ".search-input",
            "input[name='q']"
          );

        if (searchInput) {
          searchInput.focus();
        }
      }
    }
  );
}

function bindDeleteButton() {
  const deleteButton =
    getElement(
      "#delete-post-button"
    );

  if (deleteButton) {
    deleteButton.addEventListener(
      "click",
      deleteCurrentPost
    );
  }
}

function bindPostCards() {
  getElements(
    "[data-open-post]"
  ).forEach(element => {
    element.addEventListener(
      "click",
      () => {
        const id =
          element.dataset.postId ||
          element.getAttribute(
            "data-open-post"
          );

        if (id) {
          openPost(id);
        }
      }
    );
  });
}

async function initializeApp() {
  console.log(
    "Gb-Forums frontend starting..."
  );

  bindModalButtons();
  bindAuthButtons();
  bindForms();
  bindNavigation();
  bindKeyboardShortcuts();
  bindDeleteButton();
  bindPostCards();

  renderAuthState();

  await checkHealth();

  await loadCurrentUser();

  await loadForums();

  renderForums();

  updatePageTitle("All Posts");

  await loadPosts();

  setInterval(
    async () => {
      if (
        !document.hidden &&
        !state.currentPost
      ) {
        await loadPosts();
      }
    },
    30000
  );

  console.log(
    "Gb-Forums frontend ready."
  );
}

window.GbForums = {
  state,
  api,
  loadForums,
  loadPosts,
  openPost,
  searchPosts,
  showToast,
  login,
  register,
  logout
};
