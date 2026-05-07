import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { supabase } from "../lib/supabase";
import databaseSchemaRaw from "../types/database.types.ts?raw";

const queryDatabaseDeclaration: FunctionDeclaration = {
  name: "queryDatabase",
  description: "استعلام متقدم في قاعدة بيانات Supabase. استخدم هذه الأداة بذكاء لجلب البيانات واستخراج الإحصائيات.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      table: {
        type: Type.STRING,
        description: "اسم الجدول الأساسي (مثال: profiles, master_orders, driver_details، الخ)."
      },
      select: {
        type: Type.STRING,
        description: "الأعمدة المطلوبة. يمكن أن تتضمن علاقات، مثال: '*, master_orders(count)' أو '*, profiles(full_name, primary_phone)'. استخدمها لتقليل البيانات التي لا تحتاجها."
      },
      filterColumn: {
        type: Type.STRING,
        description: "اسم العمود المراد الفلترة عليه (اختياري)."
      },
      filterOperator: {
        type: Type.STRING,
        description: "نوع الفلترة (اختياري): 'eq' (يساوي)، 'neq' (لا يساوي)، 'gt' (أكبر)، 'lt' (أصغر)، 'gte'، 'lte'، 'ilike' (بحث نصي)، 'is' (مثل is null)."
      },
      filterValue: {
        type: Type.STRING,
        description: "قيمة الفلترة (نص، رقم، 'true', 'false'، أو 'null')."
      },
      isCountMode: {
        type: Type.BOOLEAN,
        description: "اجعلها true إذا كنت تريد عدد السجلات (الـ count) فقط."
      },
      orderColumn: {
        type: Type.STRING,
        description: "ترتيب النتائج بناءً على عمود معين (اختياري)."
      },
      ascending: {
        type: Type.BOOLEAN,
        description: "تصاعدي (true) أو تنازلي (false). لتفعيل الترتيب يجب تمرير orderColumn و ascending."
      },
      limit: {
        type: Type.NUMBER,
        description: "أقصى عدد للأسطر. الافتراضي 10."
      }
    },
    required: ["table"]
  }
};

async function executeQueryDatabase(args: any) {
  try {
    let query: any;
    
    // Support nested selects
    const selectStr = args.select || '*';
    if (args.isCountMode) {
      query = supabase.from(args.table).select(selectStr, { count: 'exact', head: true });
    } else {
      query = supabase.from(args.table).select(selectStr);
    }
    
    if (args.filterColumn && args.filterOperator) {
        let val: any = args.filterValue;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null') val = null;
        else if (!isNaN(Number(val)) && typeof val === 'string' && val.trim() !== '') val = Number(val);
        
        switch (args.filterOperator) {
            case 'eq': query = query.eq(args.filterColumn, val); break;
            case 'neq': query = query.neq(args.filterColumn, val); break;
            case 'gt': query = query.gt(args.filterColumn, val); break;
            case 'lt': query = query.lt(args.filterColumn, val); break;
            case 'gte': query = query.gte(args.filterColumn, val); break;
            case 'lte': query = query.lte(args.filterColumn, val); break;
            case 'ilike': query = query.ilike(args.filterColumn, "%" + val + "%"); break;
            case 'is': query = query.is(args.filterColumn, val); break;
            default: query = query.eq(args.filterColumn, val);
        }
    } else if (args.eqColumn && args.eqValue !== undefined) {
        // Fallback for previous scheme
        let val = args.eqValue;
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        query = query.eq(args.eqColumn, val);
    }
    
    if (args.orderColumn && args.ascending !== undefined) {
       query = query.order(args.orderColumn, { ascending: args.ascending });
    }
    
    if (!args.isCountMode) {
      const limit = args.limit ? Math.min(args.limit, 100) : 10;
      query = query.limit(limit);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      return { error: error.message, details: error.details, hint: error.hint };
    }
    
    if (args.isCountMode) {
      return { count: count || 0 };
    }
    
    return {
      count: data?.length || 0,
      data: data || []
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function askGemini(prompt: string, context?: any) {
  try {
    // جلب المفتاح الخاص من الخادم
    const configRes = await fetch('/api/config/gemini');
    const { apiKey } = await configRes.json();
    
    // إذا لم يكن هناك مفتاح من الخادم، نقوم باستخدام process.env كبديل (للبيئات التي تدعم ذلك)
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!finalApiKey) {
        throw new Error("لم يتم إعداد مفتاح API الخاص بالمساعد الذكي.");
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });
    const systemPrompt = `أنت مساعد الإدارة الذكي والنخبة لنظام "زاجل إكسبريس" (Zajel Express).
أنت متصل مباشرة بقاعدة البيانات اللحظية (Supabase) الخاصة بالتطبيق وبصلاحيات مطلقة، وقادر على استدعاء الأداة 'queryDatabase' للحصول على أي بيانات حقيقية ولحظية والإجابة على أي استفسار من المدير بدقة متناهية وسرعة.

لقد تم تزويدك بالأسكيما الفعلية والمحدثة لحظياً لقاعدة البيانات في هذا التطبيق (بصيغة TypeScript Interfaces). اكتشف الجداول والأعمدة وتعرف على العلاقات بناءً على هذا الهيكل المحدث لتقديم تقارير احترافية واستنتاجات ذكية:

### هيكل قاعدة البيانات الحقيقي (TypeScript Schema):
\`\`\`typescript
${databaseSchemaRaw}
\`\`\`

أنت تمتلك صلاحيات واسعة واستيعاباً عميقاً للبيانات! إليك قواعد العمل الخاصة بك لتكون كفاءتك كالنماذج العملاقة:
1. **الاستكشاف والفهم الدقيق:** عند سؤال المدير عن شيء، افهم القصد وابحث عن الجداول والأعمدة المؤدية للنتيجة. لا تخترع أسماء جداول، اعتمد فقط على الأسكيما.
2. **استغلال الفهارس (Indexes):** تم بناء فهارس (Indexes) لقاعدة البيانات لتسريع الاستعلامات. يُفضّل دائماً الفلترة والترتيب بناءً على الأعمدة المفهرسة مثل: (status, created_at, user_type, primary_phone, master_order_id, vendor_id, zone_id, date_range) للحصول على تقارير فائقة السرعة.
3. **استخدام الأداة بذكاء:** الأداة قادرة على الفلترة ('eq', 'neq', 'gt', 'lt', 'ilike', 'is')، والترتيب (orderColumn, ascending)، وجلب العلاقات المباشرة من Supabase.
   - لعمل بحث نصي عن اسم مستخدم: { table: "profiles", filterColumn: "full_name", filterOperator: "ilike", filterValue: "أحمد" }
   - للبحث عن الطلبات بعد تاريخ معين: { table: "master_orders", filterColumn: "created_at", filterOperator: "gt", filterValue: "2023-01-01" }
   - للفلترة بقيم فارغة: { table: "profiles", filterColumn: "fcm_token", filterOperator: "is", filterValue: "null" }
   - لجلب الطلبات مع معلومات العميل (علاقة): { table: "master_orders", select: "*, profiles(full_name, primary_phone)" }
4. **الاستعلام المستمر والاستنباط (Chain of Thought):** إذا احتجت لجلب بيانات من أكثر من جدول قبل الإجابة النهائية، يمكنك استدعاء 'queryDatabase' مرات متتالية، مثلاً جلب الـ ID من جدول ثم جلب التفاصيل باستخدام ذلك الـ ID من جدول آخر. هذه هي طريقتك لتكون نموذجًا نخبوياً وليس مجرد مساعد سطحي. يمكنك جمع استعلامات لا محدودة لكشف الحقائق.
5. **تجميع المعطيات المعقدة:** لتقديم نتائج عظيمة، لا تكتفِ بالإجابات القصيرة. قدم تقارير، أرقامًا دقيقة، جداول، واقتراحات لتحسين العمل.
6. **الشفافية المطلقة والمصداقية:** لا تخمن الأرقام إطلاقاً. اعتمد في إجابتك وفهمك **فقط** على الإحصائيات والأرقام المرجعة من قاعدة البيانات.
7. **العملة الأساسية:** يجب أن تستخدم العملة المحلية "الجنيه المصري" (EGP) دائماً عند عرض المبالغ المالية. لا تستخدم عملات أخرى إلا إذا طُلب ذلك صراحة.
8. **الاعتذار الإيجابي:** إذا لم تستطع الإجابة على الاستفسار (بسبب أن السؤال خارج نطاق النظام تماماً، أو نقص في البيانات، أو لأن العلاقات غير ممكنة مباشر بفلترة بسيطة)، **يجب عليك أن تذكر وتشرح بوضوح واحترافية للمدير سبب عدم قدرتك على الإجابة** أو لماذا لم تجد البيانات المطلوبة. لا تصطنع أعذاراً غير حقيقية؛ كن فنياً وواضحاً (مثلاً: "عفواً، لا يوجد حقل 'العمر' في جدول المستخدمين").
9. **التنسيق وتجربة المستخدم:** تحدث باللغة العربية بأسلوب راقٍ، استخدم تنسيق Markdown بفاعلية (جداول، قوائم، رموز تعبيرية مهنية 📊📈⏳) لتخرج المعلومات في شكل تقرير تنفيذي ممتاز ذو مظهر جذاب من اليمين لليسار.
10. السياق الحالي أو سجل الدردشة قد يكون مفيداً: ${JSON.stringify(context || {}, null, 2)}`;

    const history: any[] = [
      { role: 'user', parts: [{ text: systemPrompt + "\n\nسؤال المدير: " + prompt }] }
    ];

    let response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: history,
      config: {
        tools: [{ functionDeclarations: [queryDatabaseDeclaration] }],
        temperature: 0.1
      }
    });

    let maxIterations = 8;
    while (response.functionCalls && response.functionCalls.length > 0 && maxIterations > 0) {
      maxIterations--;
      const call = response.functionCalls[0];
      
      let result;
      if (call.name === "queryDatabase") {
        result = await executeQueryDatabase(call.args);
      } else {
        result = { error: "Unknown function" };
      }
      
      const resultString = JSON.stringify(result);
      const safeResult = resultString.length > 5000 
          ? { error: "Result too large, rows were truncated.", partial_data: resultString.slice(0, 5000) + "..." } 
          : result;

      history.push(response.candidates![0].content);
      history.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: call.name,
            response: safeResult
          }
        }]
      });

      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: history,
        config: {
          tools: [{ functionDeclarations: [queryDatabaseDeclaration] }],
           temperature: 0.2
        }
      });
    }

    // Ensure we return the final text
    if (response.text) {
        return response.text;
    } else if (response.candidates && response.candidates.length > 0 && response.candidates[0].content?.parts?.[0]?.text) {
        return response.candidates[0].content.parts[0].text;
    }
    
    return "عذراً المساعد لا يستطيع توفير الإجابة الآن.";

  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const errorMessage = error.message || '';

    if (errorMessage.includes("API Key") || errorStr.includes("API Key") || errorMessage.includes("API_KEY_INVALID")) {
        throw new Error("لم يتم إعداد مفتاح API الخاص بالمساعد الذكي (GEMINI_API_KEY) في إعدادات التطبيق. يرجى إضافته من خلال لوحة Secrets.");
    }

    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota") || errorMessage.includes("429")) {
        throw new Error("عذراً، لقد تم تجاوز الحد المسموح به للاستخدام اليومي (Quota Exceeded). يرجى المحاولة غداً أو التحقق من خطة الحساب.");
    }

    if (errorMessage.includes("404")) {
      throw new Error("عذراً، الموديل المطلوب غير متوفر حالياً. يرجى التواصل مع الدعم الفني.");
    }
    throw new Error("عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. تأكد من اتصال الإنترنت أو إعدادات المفتاح.");
  }
}
