import { extractClusterName, parseClusterTopology } from '@/components/HealthPanel'

describe('extractClusterName', () => {
  it('configIdからクラスター名を抽出する', () => {
    expect(extractClusterName('default/search/0', '', 'container')).toBe('search')
  })

  it('roleからcontainerクラスター名を抽出する', () => {
    expect(extractClusterName('', 'container/mycontainer/0', 'container')).toBe('mycontainer')
  })

  it('roleからcontentクラスター名を抽出する', () => {
    expect(extractClusterName('', 'content/mycontent/0', 'content')).toBe('mycontent')
  })

  it('情報がない場合はdefaultを返す', () => {
    expect(extractClusterName('', '', 'container')).toBe('default')
  })
})

describe('parseClusterTopology', () => {
  it('nullや非オブジェクトは空配列を返す', () => {
    expect(parseClusterTopology(null)).toEqual([])
    expect(parseClusterTopology('string')).toEqual([])
    expect(parseClusterTopology(undefined)).toEqual([])
  })

  it('nodesが空配列は空配列を返す', () => {
    expect(parseClusterTopology({ nodes: [] })).toEqual([])
  })

  it('コンテナノードを正しく解析する', () => {
    const metrics = {
      nodes: [
        {
          hostname: 'container1.example.com',
          role: 'container/default/0',
          services: [
            {
              name: 'vespa.container',
              clusterType: 'container',
              clusterName: 'default',
              configId: '',
              status: { code: 'up' },
            },
          ],
        },
      ],
    }

    const result = parseClusterTopology(metrics)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('container')
    expect(result[0].nodes).toHaveLength(1)
    expect(result[0].nodes[0].hostname).toBe('container1')
    expect(result[0].nodes[0].status).toBe('up')
  })

  it('コンテンツノードを正しく解析する', () => {
    const metrics = {
      nodes: [
        {
          hostname: 'content1.example.com',
          role: 'content/mycluster/0',
          services: [
            {
              name: 'vespa.searchnode',
              clusterType: 'content',
              clusterName: 'mycluster',
              configId: '',
              status: { code: 'up' },
            },
          ],
        },
      ],
    }

    const result = parseClusterTopology(metrics)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('content')
    expect(result[0].name).toBe('mycluster')
  })

  it('管理ノードを正しく解析する', () => {
    const metrics = {
      nodes: [
        {
          hostname: 'admin1.example.com',
          role: 'admin/0',
          services: [
            {
              name: 'vespa.configserver',
              clusterType: 'admin',
              clusterName: '',
              configId: '',
              status: { code: 'up' },
            },
          ],
        },
      ],
    }

    const result = parseClusterTopology(metrics)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('admin')
  })

  it('複数ノードが同じクラスターに集約される', () => {
    const metrics = {
      nodes: [
        {
          hostname: 'node1.example.com',
          role: '',
          services: [
            {
              name: 'vespa.container',
              clusterType: 'container',
              clusterName: 'search',
              configId: '',
              status: { code: 'up' },
            },
          ],
        },
        {
          hostname: 'node2.example.com',
          role: '',
          services: [
            {
              name: 'vespa.container',
              clusterType: 'container',
              clusterName: 'search',
              configId: '',
              status: { code: 'up' },
            },
          ],
        },
      ],
    }

    const result = parseClusterTopology(metrics)
    expect(result).toHaveLength(1)
    expect(result[0].nodes).toHaveLength(2)
  })
})
