import Core from './core.js'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export default class farmingsimulator extends Core {
  async run(state) {
    if (!this.options.port) this.options.port = 8080
    if (!this.options.token)
      throw new Error(`No token provided. You can get it from http://${this.options.host}:${this.options.port}/settings.html`)

    try {
      const request = await this.request({
        url: `http://${this.options.host}:${this.options.port}/feed/dedicated-server-stats.xml?code=${this.options.token}`,
        responseType: 'text'
      })

      const isValidXML = XMLValidator.validate(request)
      if (!isValidXML) {
        throw new Error('Invalid XML received from Farming Simulator Server')
      }

      const parser = new XMLParser({ ignoreAttributes: false })
      const parsed = parser.parse(request)

      const serverInfo = parsed.Server
      const playerInfo = serverInfo.Slots

      const decodeEntities = str => str
        ? str
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#94;/g, '^')
        : str

      state.name = decodeEntities(serverInfo['@_name'])
      state.map = decodeEntities(serverInfo['@_mapName'])
      state.version = serverInfo['@_version']

      const numPlayers = parseInt(playerInfo['@_numUsed'], 10) || 0
      const maxPlayers = parseInt(playerInfo['@_capacity'], 10) || 0

      state.numplayers = numPlayers
      state.maxplayers = maxPlayers
      const players = playerInfo.Player || []
      const vehicles = serverInfo?.Vehicles?.Vehicle || []

      vehicles.forEach(v => {
        v['@_controller'] = decodeEntities(v['@_controller'])
        v['@_name'] = decodeEntities(v['@_name'])
      })

      state.players = []
      let idCounter = 0

      for (const player of players) {
        if (player['@_isUsed'] !== 'true') continue

        const playerName = decodeEntities(player['#text'])
        let x = null, z = null
        let machineName = 'brak'

        const vehicle = vehicles.find(v => v['@_controller'] === playerName)
        if (vehicle) {
          machineName = vehicle['@_name'] || 'brak'
          x = parseFloat(vehicle['@_x']) || null
          z = parseFloat(vehicle['@_z']) || null
        } else {
          x = parseFloat(player['@_x']) || null
          z = parseFloat(player['@_z']) || null
        }

        state.players.push({
          id: idCounter++,
          name: playerName,
          isAdmin: player['@_isAdmin'] === 'true',
          machine_name: machineName,
          x,
          z
        })
      }

      state.online = true
    } catch (err) {
      console.error(
        'Błąd pobierania danych z serwera:',
        err,
        'Zawartość: ',
        err?.response || '',
        'Dane: ',
        `http://${this.options.host}:${this.options.port}/feed/dedicated-server-stats.xml?code=${this.options.token}`
      )

      state.online = false
      state.players = []
    }
  }
}
