import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Hook للكشف التلقائي عن التحديثات
 * يفحص كل 3 دقائق ويُخبر المستخدم عند وجود نسخة جديدة
 */
export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newWorker, setNewWorker] = useState(null);

  useEffect(() => {
    // التحقق من دعم Service Worker
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    // مراقبة تغيير Controller (عند تفعيل SW جديد)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Controller changed - reloading page');
      window.location.reload();
    });

    // تسجيل Service Worker ومراقبة التحديثات
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        // فحص التحديثات كل 3 دقائق
        setInterval(() => {
          registration.update();
        }, 3 * 60 * 1000);

        // مراقبة Service Worker الجديد
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // نسخة جديدة متاحة!
                console.log('New version available!');
                setUpdateAvailable(true);
                setNewWorker(installingWorker);

                // عرض toast للمستخدم
                toast.info('يوجد تحديث جديد!', {
                  description: 'اضغط هنا لتحديث الصفحة',
                  duration: Infinity,
                  action: {
                    label: 'تحديث الآن',
                    onClick: () => {
                      installingWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                  }
                });
              } else {
                // أول تثبيت للـ SW
                console.log('Service Worker installed for the first time');
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });

    // فحص النسخة عبر API
    checkVersion();
    const versionCheckInterval = setInterval(checkVersion, 3 * 60 * 1000);

    return () => {
      clearInterval(versionCheckInterval);
    };
  }, []);

  const checkVersion = async () => {
    try {
      const response = await fetch('/version.json?' + Date.now(), {
        cache: 'no-store'
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const currentVersion = localStorage.getItem('app_version');

      if (currentVersion && currentVersion !== data.version.toString()) {
        console.log('New version detected:', data.version);
        setUpdateAvailable(true);

        toast.info('يوجد تحديث جديد!', {
          description: 'اضغط لتحديث الصفحة',
          duration: Infinity,
          action: {
            label: 'تحديث',
            onClick: () => {
              localStorage.setItem('app_version', data.version);
              window.location.reload(true);
            }
          }
        });
      } else if (!currentVersion) {
        localStorage.setItem('app_version', data.version);
      }
    } catch (error) {
      // فشل الفحص - تجاهل بصمت
      console.debug('Version check failed:', error);
    }
  };

  const applyUpdate = () => {
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload(true);
    }
  };

  return { updateAvailable, applyUpdate };
}
