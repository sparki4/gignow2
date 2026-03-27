
        // DIAGNOSTIC START
        setTimeout(() => {
            const jobsRef = ref(db, 'jobs');
            get(jobsRef).then(() => {
                console.log('Initial connection successful');
            }).catch((error) => {
                alert('Connection Failed:\n' + error.message);
                document.body.innerHTML += `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;color:red;z-index:9999;padding:20px;">
                    <h1>Connection Failed</h1>
                    <pre>${JSON.stringify(error, null, 2)}</pre>
                    <p>${error.message}</p>
                </div>`;
            });
        }, 2000);
        // DIAGNOSTIC END
