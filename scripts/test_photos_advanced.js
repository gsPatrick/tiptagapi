const { CatalogoService, Peca, FotoPeca, sequelize } = require('../src/models');
const catalogoService = require('../src/features/catalogo/catalogo.service');

async function testPhotoSavingAdvanced() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Testing Advanced Photo Saving ---');

        const peca = await Peca.findOne();
        if (!peca) throw new Error('No piece found');

        // Test with objects (as if sent back from frontend)
        const fotos = [
            { url: '/uploads/obj_1.jpg', id: 100 },
            { url: '/uploads/obj_2.jpg', id: 101 },
            '/uploads/str_3.jpg'
        ];

        console.log('Updating with mixed array...');
        await catalogoService.updatePeca(peca.id, { fotos });

        const updated = await catalogoService.getPecaById(peca.id);
        console.log(`Saved Photos: ${updated.fotos.length}`);
        updated.fotos.forEach(f => console.log(`- ${f.url}`));

        if (updated.fotos.length === 3) {
            console.log('✅ Success: Mixed photo formats handled.');
        } else {
            console.log('❌ Failure.');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

testPhotoSavingAdvanced();
