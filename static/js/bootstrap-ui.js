(function () {
    "use strict";

    function mapIconToVariant(icon) {
        if (icon === "success") return "success";
        if (icon === "error") return "danger";
        if (icon === "warning") return "warning";
        if (icon === "info") return "info";
        return "secondary";
    }

    function getToastContainer() {
        var existing = document.getElementById("appToastContainer");
        if (existing) return existing;

        var container = document.createElement("div");
        container.id = "appToastContainer";
        container.className = "toast-container position-fixed top-0 end-0 p-3";
        container.style.zIndex = "1085";
        document.body.appendChild(container);
        return container;
    }

    function showToast(options) {
        var bootstrapRef = window.bootstrap;
        if (!bootstrapRef || !bootstrapRef.Toast) {
            window.alert(options.text || options.title || "");
            return Promise.resolve({ isConfirmed: true, isDismissed: false });
        }

        var variant = mapIconToVariant(options.icon);
        var toast = document.createElement("div");
        toast.className = "toast border-0 shadow";
        toast.setAttribute("role", "alert");
        toast.setAttribute("aria-live", "assertive");
        toast.setAttribute("aria-atomic", "true");

        toast.innerHTML = [
            '<div class="toast-header bg-white">',
            '<span class="badge rounded-pill text-bg-' + variant + ' me-2">&nbsp;</span>',
            '<strong class="me-auto" data-toast-title></strong>',
            '<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>',
            "</div>",
            '<div class="toast-body"></div>',
        ].join("");

        toast.querySelector("[data-toast-title]").textContent = options.title || "通知";
        toast.querySelector(".toast-body").textContent = options.text || "";
        getToastContainer().appendChild(toast);

        var instance = bootstrapRef.Toast.getOrCreateInstance(toast, {
            autohide: options.timer !== 0,
            delay: options.timer || 2600,
        });

        toast.addEventListener(
            "hidden.bs.toast",
            function () {
                toast.remove();
            },
            { once: true }
        );
        instance.show();
        return Promise.resolve({ isConfirmed: true, isDismissed: false });
    }

    var modalState = {
        el: null,
        instance: null,
        title: null,
        body: null,
        confirm: null,
        cancel: null,
        resolve: null,
        result: { isConfirmed: false, isDismissed: true },
    };

    function ensureModal() {
        var bootstrapRef = window.bootstrap;
        if (!bootstrapRef || !bootstrapRef.Modal) {
            return null;
        }

        if (modalState.el) {
            return modalState;
        }

        var modal = document.createElement("div");
        modal.className = "modal fade";
        modal.tabIndex = -1;
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = [
            '<div class="modal-dialog modal-dialog-centered">',
            '<div class="modal-content border-0 shadow-lg">',
            '<div class="modal-header">',
            '<h1 class="modal-title fs-5"></h1>',
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>',
            "</div>",
            '<div class="modal-body"></div>',
            '<div class="modal-footer">',
            '<button type="button" class="btn btn-outline-secondary" data-modal-cancel>キャンセル</button>',
            '<button type="button" class="btn btn-primary" data-modal-confirm>OK</button>',
            "</div>",
            "</div>",
            "</div>",
        ].join("");

        document.body.appendChild(modal);

        modalState.el = modal;
        modalState.instance = new bootstrapRef.Modal(modal);
        modalState.title = modal.querySelector(".modal-title");
        modalState.body = modal.querySelector(".modal-body");
        modalState.confirm = modal.querySelector("[data-modal-confirm]");
        modalState.cancel = modal.querySelector("[data-modal-cancel]");

        modalState.confirm.addEventListener("click", function () {
            modalState.result = { isConfirmed: true, isDismissed: false };
            modalState.instance.hide();
        });

        modalState.cancel.addEventListener("click", function () {
            modalState.result = { isConfirmed: false, isDismissed: true };
            modalState.instance.hide();
        });

        modal.addEventListener("hidden.bs.modal", function () {
            if (typeof modalState.resolve === "function") {
                modalState.resolve(modalState.result);
            }
            modalState.resolve = null;
            modalState.result = { isConfirmed: false, isDismissed: true };
        });

        return modalState;
    }

    function showModal(options) {
        var modal = ensureModal();
        if (!modal) {
            var text = options.text || "";
            if (options.showCancelButton) {
                var confirmed = window.confirm(text || options.title || "");
                return Promise.resolve({ isConfirmed: confirmed, isDismissed: !confirmed });
            }
            window.alert(text || options.title || "");
            return Promise.resolve({ isConfirmed: true, isDismissed: false });
        }

        var variant = mapIconToVariant(options.icon);
        modal.title.textContent = options.title || "確認";
        modal.body.textContent = options.text || "";
        modal.cancel.style.display = options.showCancelButton ? "" : "none";
        modal.cancel.textContent = options.cancelButtonText || "キャンセル";
        modal.confirm.textContent = options.confirmButtonText || "閉じる";
        modal.confirm.className = "btn btn-" + (variant === "info" ? "primary" : variant);

        if (!options.showCancelButton && options.showConfirmButton === false) {
            return showToast(options);
        }

        return new Promise(function (resolve) {
            modal.resolve = resolve;
            modal.result = { isConfirmed: false, isDismissed: true };
            modal.instance.show();
        });
    }

    window.Swal = {
        fire: function (options) {
            var normalized = options || {};
            if (typeof normalized === "string") {
                normalized = { text: normalized };
            }

            if (normalized.timer && normalized.showConfirmButton === false) {
                return showToast(normalized);
            }

            if (normalized.toast) {
                return showToast(normalized);
            }

            return showModal(normalized);
        },
    };

    window.AozoraBootstrapUI = {
        showToast: showToast,
    };
})();
