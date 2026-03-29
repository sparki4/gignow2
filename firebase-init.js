        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

        function escErr(s) {
            const fn = globalThis.escapeHtml;
            if (typeof fn === 'function') return fn(String(s ?? ''));
            return String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function isSafeHttpUrl(url) {
            if (!url || typeof url !== 'string') return false;
            try {
                const u = new URL(url, window.location.href);
                return u.protocol === 'https:' || u.protocol === 'http:';
            } catch {
                return false;
            }
        }

        function setNavAvatar(avatarEl, photoURL) {
            avatarEl.textContent = '';
            if (photoURL && isSafeHttpUrl(photoURL)) {
                const img = document.createElement('img');
                img.src = photoURL;
                img.className = 'w-5 h-5 rounded-full object-cover';
                img.alt = '';
                img.referrerPolicy = 'no-referrer';
                img.decoding = 'async';
                avatarEl.appendChild(img);
            } else {
                const i = document.createElement('i');
                i.setAttribute('data-lucide', 'user');
                i.className = 'w-4 h-4 text-blue-600';
                avatarEl.appendChild(i);
            }
        }

        const firebaseConfig = {
            apiKey: "AIzaSyBx6d42SKxb5k_tHPSAMPnIr8IOHQhDVVs",
            authDomain: "jobsnap-18047.firebaseapp.com",
            databaseURL: "https://jobsnap-18047-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "jobsnap-18047",
            storageBucket: "jobsnap-18047.firebasestorage.app",
            messagingSenderId: "538414090512",
            appId: "1:538414090512:web:913e5ebdf01d20eb46bd95",
            measurementId: "G-S0QB8Z7S9X"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        auth.languageCode = 'he';
        const db = getDatabase(app);
        const googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account', hl: 'he' });

        // --- Analytics & A/B Testing ---

        // 1. Assign A/B Group
        function getABGroup() {
            let group = localStorage.getItem('jobsnap_ab_group');
            if (!group) {
                group = Math.random() < 0.5 ? 'A' : 'B';
                localStorage.setItem('jobsnap_ab_group', group);
            }
            return group;
        }

        const userGroup = getABGroup();
        console.log('User assigned to AB Group:', userGroup);

        // 2. Log Event to Firebase
        function logEvent(eventName, params = {}) {
            const dateStr = new Date().toISOString().split('T')[0];
            const eventData = { timestamp: Date.now(), group: userGroup, ...params };
            const analyticsRef = ref(db, `analytics/${dateStr}/${eventName}`);
            // Completely silent catch for analytics permission errors
            // Use set on a single ref for better performance or push as before
            try {
                push(analyticsRef, eventData).catch(() => { });
            } catch (e) { }
        }

        window.fb = {
            auth, db, googleProvider,
            signInWithPopup, signOut, push, set, ref, remove, update, onValue, get,
            createUserWithEmailAndPassword, signInWithEmailAndPassword,
            logEvent
        };

        // Render Logic with Retry
        setTimeout(() => {
            if (window.renderJobs) window.renderJobs();
            if (window.renderWorkers) window.renderWorkers();
        }, 1000);
        setTimeout(() => {
            if (window.renderJobs) window.renderJobs();
            if (window.renderWorkers) window.renderWorkers();
        }, 3000);

        // Rating system initialized later in the second script block


        onAuthStateChanged(auth, async (user) => {
            window.currentUser = user;
            updateLoginHint();

            if (user) {
                // --- Avatar Logic ---
                const avatarEl = document.getElementById('nav-avatar');
                if (avatarEl) {
                    setNavAvatar(avatarEl, user.photoURL);
                }

                const imgs = document.querySelectorAll('#profile-img');
                const displayName = user.displayName || user.email.split('@')[0];
                const avatarFallback = 'https://ui-avatars.com/api/?background=random&name=' + encodeURIComponent(displayName);
                imgs.forEach(img => {
                    img.src = (user.photoURL && isSafeHttpUrl(user.photoURL)) ? user.photoURL : avatarFallback;
                });

                if (document.getElementById('profile-name')) document.getElementById('profile-name').innerText = displayName;
                if (document.getElementById('profile-email')) document.getElementById('profile-email').innerText = user.email;

                if (user.email === ADMIN_EMAIL) {
                    document.getElementById('admin-indicator').classList.remove('hidden');
                } else {
                    document.getElementById('admin-indicator').classList.add('hidden');
                }

                checkBlockStatus();
                checkWorkerStatus();
                logEvent('user_session_start', { uid: user.uid });

                // Sync user to DB on EVERY login (ensures all users have DB entries)
                try {
                    const userRef = ref(db, 'users/' + user.uid);
                    const snap = await get(userRef);
                    const existing = snap.val();
                    const syncData = {
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0],
                        lastSeen: new Date().toISOString()
                    };
                    if (!existing) {
                        syncData.blocked = false;
                        syncData.blocked_posting = false;
                    }
                    await update(userRef, syncData);
                    console.log('[Sync-Primary] User synced:', user.uid, user.email);
                } catch (e) {
                    console.error('[Sync-Primary] Error:', e);
                }

                // Check if email is in banned list
                try {
                    const bannedRef = ref(db, 'banned_emails/' + user.email.replace(/\./g, ','));
                    const bannedSnap = await get(bannedRef);
                    if (bannedSnap.val() === true) {
                        await update(ref(db, 'users/' + user.uid), { blocked: true });
                        console.log('[Sync-Primary] Email is banned, auto-blocking:', user.email);
                    }
                } catch (e) {
                    console.error('[Sync-Primary] Ban check error:', e);
                }
            } else {
                const navAv = document.getElementById('nav-avatar');
                if (navAv) setNavAvatar(navAv, null);
            }
            // Ensure icons are rendered
            try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { }
        });

        const jobsRef = ref(db, 'jobs');
        onValue(jobsRef, (snapshot) => {
            const data = snapshot.val();
            window.allJobs = data ? Object.entries(data).map(([key, val]) => ({ ...val, id: key })) : [];
            console.log('[JobsListener-Primary] Loaded', window.allJobs.length, 'jobs');
            if (document.getElementById('stat-jobs')) document.getElementById('stat-jobs').innerText = window.allJobs.length;
            const feedScreen = document.getElementById('screen-feed');
            if (window.renderJobs) {
                window.renderJobs();
                try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { console.warn('Icons error', e); }
            }

            const loader = document.getElementById('jobs-loader');
            if (loader) loader.classList.add('hidden');
        }, (error) => {
            console.error('[JobsListener] Error:', error);
            const container = document.getElementById('jobs-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-12 text-red-500 font-bold bg-red-50 rounded-xl border border-red-200 p-4 mx-4">
                        <div class="text-3xl mb-2">⚠️</div>
                        <div>שגיאת טעינה</div>
                        <div class="text-[10px] font-mono mt-2 dir-ltr text-left bg-white p-2 rounded border border-red-100 shadow-inner overflow-auto max-h-32">
                            ${error.code ? `Code: ${escErr(error.code)}<br>` : ''}
                            ${escErr(error.message)}
                        </div>
                        <div class="text-xs text-slate-500 mt-2">נא לרענן את הדף או לבדוק חיבור רשת</div>
                    </div>`;
            }
        });

        const workersRef = ref(db, 'workers');
        onValue(workersRef, (snapshot) => {
            const data = snapshot.val();
            window.allWorkers = data ? Object.entries(data).map(([key, val]) => ({ ...val, uid: key })) : [];
            console.log('[WorkersListener] Loaded', window.allWorkers.length, 'workers');
            if (document.getElementById('stat-workers')) document.getElementById('stat-workers').innerText = window.allWorkers.length;
            if (window.renderWorkers) {
                window.renderWorkers();
                try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { console.warn('Icons error', e); }
            }
            if (window.currentUser) checkWorkerStatus();
        }, (error) => {
            console.error('[WorkersListener] Error:', error);
            const container = document.getElementById('workers-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-12 text-red-500 font-bold bg-red-50 rounded-xl border border-red-200 p-4 mx-4">
                        <div class="text-3xl mb-2">⚠️</div>
                        <div>שגיאת טעינה (עובדים)</div>
                        <div class="text-[10px] font-mono mt-2 dir-ltr text-left bg-white p-2 rounded border border-red-100 shadow-inner overflow-auto max-h-32">
                            ${error.code ? `Code: ${escErr(error.code)}<br>` : ''}
                            ${escErr(error.message)}
                        </div>
                    </div>`;
            }
        });
