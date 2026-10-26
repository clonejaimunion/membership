import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { api, getErrorMessage } from '../lib/api';

export default function LocalUpdateManager() {
  const [status, setStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    checkUpdateStatus();
    
    // Poll status every 2 seconds when update is running
    const interval = setInterval(() => {
      if (status?.status === 'running') {
        checkUpdateStatus();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [status?.status]);

  const checkUpdateStatus = async () => {
    try {
      const res = await api.get('/admin/update/status');
      setStatus(res.data);
      
      // Check if update is available
      const updateCheck = await api.get('/admin/update/check');
      setUpdateAvailable(updateCheck.data.updateAvailable);
    } catch (err) {
      console.error('Failed to check update status:', err);
    }
  };

  const triggerUpdate = async () => {
    if (!window.confirm('هل أنت متأكد من بدء عملية التحديث؟\n\nسيتم:\n- إعادة بناء الواجهة\n- تحديث Service Worker\n- إعادة تحميل جميع المتصفحات المفتوحة\n\nقد يستغرق دقيقة واحدة.')) {
      return;
    }

    setIsChecking(true);
    try {
      await api.post('/admin/update/trigger');
      toast.success('تم بدء عملية التحديث');
      checkUpdateStatus();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsChecking(false);
    }
  };

  const acknowledgeUpdate = async () => {
    try {
      await api.post('/admin/update/acknowledge');
      toast.success('سيتم تحديث الصفحة...');
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getStatusColor = () => {
    if (!status) return 'bg-gray-500';
    switch (status.status) {
      case 'running':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (!status) return null;
    switch (status.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'success':
        return <Check className="h-5 w-5" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <RefreshCw className="h-5 w-5" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          مدير التحديثات المحلي
        </CardTitle>
        <CardDescription>
          تحديث النظام بضغطة زر واحدة - بدون PowerShell
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Update Available Alert */}
        {updateAvailable && status?.status !== 'running' && (
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription>
              يوجد تحديث جديد متاح! اضغط "تحديث الآن" لتطبيقه.
              <Button
                size="sm"
                onClick={acknowledgeUpdate}
                className="mr-2"
              >
                تحديث الصفحة
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Display */}
        {status && status.status !== 'idle' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${getStatusColor()} animate-pulse`} />
              <span className="font-medium">
                {status.status === 'running' && 'جاري التحديث...'}
                {status.status === 'success' && 'اكتمل التحديث ✓'}
                {status.status === 'failed' && 'فشل التحديث ✗'}
              </span>
              {getStatusIcon()}
            </div>

            {status.status === 'running' && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{status.step}</span>
                    <span>{status.progress}%</span>
                  </div>
                  <Progress value={status.progress} className="h-2" />
                </div>
                <p className="text-sm text-gray-600">{status.message}</p>
              </>
            )}

            {status.status === 'success' && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {status.message}
                  <br />
                  <span className="text-sm">
                    جميع المتصفحات المفتوحة ستحصل على إشعار بالتحديث تلقائياً.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {status.status === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={triggerUpdate}
            disabled={isChecking || status?.status === 'running'}
            className="gap-2"
          >
            {isChecking || status?.status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {status?.status === 'running' ? 'جاري التحديث...' : 'تطبيق التحديث'}
          </Button>

          <Button
            variant="outline"
            onClick={checkUpdateStatus}
            disabled={status?.status === 'running'}
          >
            تحديث الحالة
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 border-t pt-3 mt-4">
          <p className="font-medium mb-1">ماذا يفعل "تطبيق التحديث"؟</p>
          <ul className="list-disc list-inside space-y-0.5 mr-2">
            <li>إنشاء نسخة احتياطية تلقائية</li>
            <li>إعادة بناء واجهة React</li>
            <li>تحديث Service Worker برقم إصدار جديد</li>
            <li>إشعار جميع المتصفحات المفتوحة بالتحديث</li>
            <li>إعادة تحميل الصفحات تلقائياً</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
