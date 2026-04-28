export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Если это предварительный запрос (OPTIONS), отвечаем OK
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Принимаем только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phone, answers } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Phone is required' });
    }

    // Берем секретные ключи из переменных окружения Vercel
    const subdomain = process.env.AMO_SUBDOMAIN; 
    const token = process.env.AMO_TOKEN;

    try {
        // 1. Формируем запрос "Complex" (Создает Сделку + Контакт одновременно)
        const leadData = [
            {
                name: 'qweez.me: Лид (QUIZ) ', // Название сделки
                price: 0,
                _embedded: {
                    contacts: [
                        {
                            first_name: name || 'Аты көрсетілмеген',
                            custom_fields_values: [
                                {
                                    field_code: 'PHONE', // Системный код поля "Телефон"
                                    values: [{ value: phone }]
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        // Отправляем запрос в AmoCRM API
        const leadResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/complex`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
        });

        const leadResult = await leadResponse.json();

        // 2. Добавляем примечание с ответами (если сделка создана успешно)
        if (leadResponse.ok && leadResult && leadResult[0] && leadResult[0].id) {
            const leadId = leadResult[0].id;
            
            const noteData = [
                {
                    entity_id: leadId,
                    note_type: 'common',
                    params: {
                        text: answers
                    }
                }
            ];

            await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(noteData)
            });
        }

        // Отвечаем нашему сайту, что всё прошло успешно
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Қате (AmoCRM):', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}