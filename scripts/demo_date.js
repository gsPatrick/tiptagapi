const { startOfMonth, endOfMonth, addMonths } = require('date-fns');

function demonstrateExpiration() {
    const today = new Date();
    console.log(`Hoje: ${today.toLocaleString()}`);

    // Logic usually used for "end of current month"
    const endCurrent = endOfMonth(today);
    console.log(`Fim do Mês Atual: ${endCurrent.toLocaleString()}`);

    // Logic for "end of NEXT month" (common for store credits)
    const nextMonth = addMonths(today, 1);
    const endNext = endOfMonth(nextMonth);
    console.log(`Fim do Próximo Mês: ${endNext.toLocaleString()}`);
}

demonstrateExpiration();
