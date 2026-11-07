// Everything here is progressive enhancement: each page works without it.
document.addEventListener("DOMContentLoaded", function () {
  initNav();
  initCopyButtons();
  initServerStatus();
  initChangelogFilter();
});

function initNav() {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  function setOpen(isOpen) {
    links.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  toggle.addEventListener("click", function () {
    setOpen(!links.classList.contains("open"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && links.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  links.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });
}

function initCopyButtons() {
  var buttons = document.querySelectorAll("[data-copy]");
  if (!buttons.length) return;

  var announcer = document.createElement("span");
  announcer.className = "sr-only";
  announcer.setAttribute("role", "status");
  document.body.appendChild(announcer);

  buttons.forEach(function (button) {
    var timer;

    function flash(label, message) {
      button.textContent = label;
      announcer.textContent = message;
      clearTimeout(timer);
      timer = setTimeout(function () {
        button.textContent = "Copy";
        announcer.textContent = "";
      }, 2500);
    }

    button.hidden = false;
    button.addEventListener("click", function () {
      var value = button.getAttribute("data-copy");

      if (!navigator.clipboard) {
        flash("Failed", "Could not copy. The address is " + value);
        return;
      }

      navigator.clipboard.writeText(value).then(
        function () {
          flash("Copied", value + " copied to clipboard");
        },
        function () {
          flash("Failed", "Could not copy. The address is " + value);
        }
      );
    });
  });
}

// The TreeStats monitor polls the server every ten minutes. An older reading
// than this means the monitor itself is stuck, so don't report it as current.
var STATUS_MAX_AGE_MS = 60 * 60 * 1000;
var STATUS_URL = "https://servers.treestats.net/api/statuses/Buadren%20AC";

function initServerStatus() {
  var pills = document.querySelectorAll("[data-server-status]");
  if (!pills.length) return;

  function render(state, text) {
    pills.forEach(function (pill) {
      pill.setAttribute("data-state", state);
      pill.querySelector("[data-status-text]").textContent = text;
    });
  }

  var controller = new AbortController();
  var timeout = setTimeout(function () {
    controller.abort();
  }, 8000);

  render("unknown", "Checking server status…");

  fetch(STATUS_URL, { signal: controller.signal })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      var latest = data.statuses[0];
      var age = Date.now() - new Date(latest.created_at).getTime();

      if (!(age < STATUS_MAX_AGE_MS)) {
        render("unknown", "Check server status");
      } else if (latest.status === "UP") {
        render("up", "Server online");
      } else if (latest.status === "DOWN") {
        render("down", "Server offline");
      } else {
        render("unknown", "Check server status");
      }
    })
    .catch(function () {
      render("unknown", "Check server status");
    })
    .finally(function () {
      clearTimeout(timeout);
    });
}

function initChangelogFilter() {
  var tools = document.getElementById("log-tools");
  if (!tools) return;

  var search = document.getElementById("log-search");
  var count = document.getElementById("log-count");
  var empty = document.getElementById("log-empty");
  var tagButtons = tools.querySelectorAll("[data-filter-tag]");
  var groups = document.querySelectorAll(".year-group");
  var entries = document.querySelectorAll(".changelog-entry");
  var activeTag = "";
  var debounce;

  function apply() {
    var query = search.value.trim().toLowerCase();
    var visible = 0;

    entries.forEach(function (entry) {
      var tags = entry.getAttribute("data-tags").split(" ");
      var matches =
        (!activeTag || tags.indexOf(activeTag) !== -1) &&
        (!query || entry.textContent.toLowerCase().indexOf(query) !== -1);

      entry.hidden = !matches;
      if (matches) visible += 1;
    });

    groups.forEach(function (group) {
      group.hidden = !group.querySelector(".changelog-entry:not([hidden])");
    });

    empty.hidden = visible !== 0;
    count.textContent =
      "Showing " + visible + " of " + entries.length + " " + (entries.length === 1 ? "entry" : "entries");
  }

  tagButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      activeTag = button.getAttribute("data-filter-tag");
      tagButtons.forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      apply();
    });
  });

  search.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(apply, 150);
  });

  tools.hidden = false;
  apply();
}
