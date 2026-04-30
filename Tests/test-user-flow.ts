
import { userService } from './src/services/userService';
import { supabaseAdmin } from './src/lib/supabaseAdmin';

async function runTest() {
  const testEmail = `test.user.${Date.now()}@test.com`;
  const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
  let testUserId = '';

  console.log('--- بدأت عملية الاختبار ---');

  try {
    // 1. اختبار الإضافة
    console.log(`1. محاولة إضافة مستخدم ببريد: ${testEmail}`);
    const newUser = await userService.createUser({
      full_name: 'مستخدم تجريبي',
      email: testEmail,
      primary_phone: testPhone,
      password: 'TestPassword123!',
      user_type: 'customer',
      city: 'القاهرة'
    });
    testUserId = newUser.user_id;
    console.log(`✅ نجحت إضافة المستخدم. المعرف: ${testUserId}`);

    // 2. اختبار الحذف (الأرشفة)
    console.log('2. محاولة حذف (أرشفة) المستخدم...');
    const deleteResult = await userService.deleteUser(testUserId);
    console.log(`✅ نتيجة الحذف: ${JSON.stringify(deleteResult)}`);

    // 3. التحقق من تحرير البيانات
    console.log('3. التحقق من تحرير البريد الإلكتروني في قاعدة البيانات...');
    const { data: archivedProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    console.log(`البريد الحالي في سجل الأرشفة: ${archivedProfile?.email}`);
    if (archivedProfile?.email !== testEmail) {
      console.log('✅ تم تغيير البريد بنجاح وتحرير البريد الأصلي.');
    } else {
      console.log('❌ لم يتم تغيير البريد الإلكتروني!');
    }

    // 4. اختبار إعادة استخدام نفس البيانات
    console.log(`4. محاولة إضافة مستخدم جديد بنفس البيانات السابقة: ${testEmail}`);
    const secondUser = await userService.createUser({
      full_name: 'مستخدم جديد بنفس البيانات',
      email: testEmail,
      primary_phone: testPhone,
      password: 'NewPassword123!',
      user_type: 'customer'
    });
    console.log(`✅ نجحت إضافة المستخدم الثاني بنفس البيانات! المعرف: ${secondUser.user_id}`);

    // تنظيف النهائي
    await userService.deleteUser(secondUser.user_id);
    console.log('--- انتهى الاختبار بنجاح تام ---');

  } catch (error: any) {
    console.error('❌ فشل الاختبار:', error.message);
  }
}

runTest();
